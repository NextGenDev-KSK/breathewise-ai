import "@/lib/zodConfig";
import { NextResponse, type NextRequest } from "next/server";
import {
  AssistantRequestSchema,
  AssistantResponseSchema,
  MAX_BODY_BYTES,
  type AssistantApiSuccess,
  type AssistantErrorCode,
  type AssistantRequest,
  type AssistantResponse,
} from "@/lib/ai/schema";
import { findUnsupportedClaims, humanizeTimestamps } from "@/lib/ai/guard";
import { GeminiError, generateAssistantJson, readGeminiConfig, type GeminiConfig } from "@/lib/ai/gemini";
import { isSameOriginRequest } from "@/lib/security/origin";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Leaves headroom above the 30 s Gemini budget so the platform never cuts a request short. */
export const maxDuration = 60;

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const MESSAGES: Record<AssistantErrorCode, string> = {
  invalid_request: "The request was not valid.",
  forbidden_origin: "Requests must come from this site.",
  payload_too_large: "The request is too large.",
  unsupported_media_type: "Requests must be JSON.",
  rate_limited: "Too many questions in a short time. Please wait a moment.",
  ai_not_configured: "The AI assistant is not configured on this server. Rule-based guidance is available.",
  ai_timeout: "The AI assistant took too long to respond.",
  ai_rate_limited: "The AI service's usage limit was reached. Please try again in a minute.",
  ai_unavailable: "The AI assistant is temporarily unavailable.",
  ai_invalid_output: "The AI response did not pass validation, so it was discarded.",
};

/** A rejected request: the error code, HTTP status, and optional headers or message override. */
interface Failure {
  code: AssistantErrorCode;
  status: number;
  headers?: Record<string, string>;
  message?: string;
}

type Step<T> = { ok: true; value: T } | { ok: false; failure: Failure };

const reject = (failure: Failure): { ok: false; failure: Failure } => ({ ok: false, failure });

function failureResponse({ code, status, headers = {}, message = MESSAGES[code] }: Failure) {
  return NextResponse.json({ error: code, message }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Reads the body with a hard byte limit, independent of the Content-Length header. */
async function readLimitedBody(req: NextRequest): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Cheap checks before reading the body: same origin, JSON content type, rate limit. */
function checkGate(req: NextRequest): Failure | null {
  // Stops other websites from spending this deployment's AI quota through visitors' browsers.
  if (!isSameOriginRequest(req.headers, req.url)) return { code: "forbidden_origin", status: 403 };
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { code: "unsupported_media_type", status: 415 };
  }
  const rate = limiter(clientKey(req.headers));
  if (!rate.allowed) {
    return { code: "rate_limited", status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } };
  }
  return null;
}

/** Reads, parses and validates the body. Only the first validation message is returned, never the input. */
async function parseRequest(req: NextRequest): Promise<Step<AssistantRequest>> {
  const raw = await readLimitedBody(req);
  if (raw === null) return reject({ code: "payload_too_large", status: 413 });
  const json = parseJson(raw);
  if (json === undefined) {
    return reject({ code: "invalid_request", status: 400, message: "The request body is not valid JSON." });
  }
  const parsed = AssistantRequestSchema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  const first = parsed.error.issues[0];
  const message = first?.path[0] === "message" ? first.message : MESSAGES.invalid_request;
  return reject({ code: "invalid_request", status: 400, message });
}

/** Asks Gemini; maps timeouts, quota and other upstream errors to typed failures. */
async function askModel(request: AssistantRequest, config: GeminiConfig): Promise<Step<string>> {
  try {
    return { ok: true, value: await generateAssistantJson(request, config) };
  } catch (err) {
    if (err instanceof GeminiError && err.kind === "timeout")
      return reject({ code: "ai_timeout", status: 504 });
    if (err instanceof GeminiError && err.kind === "rate-limited") {
      return reject({ code: "ai_rate_limited", status: 503, headers: { "Retry-After": "60" } });
    }
    // Only the error kind and HTTP status are logged: upstream messages can contain request metadata.
    const detail = err instanceof GeminiError ? `${err.kind} ${err.status ?? ""}`.trim() : "unknown";
    console.error("assistant: upstream model error", detail);
    return reject({ code: "ai_unavailable", status: 502 });
  }
}

/** Accepts only schema-valid JSON whose numbers and claims are grounded in the supplied data. */
function validateOutput(text: string, request: AssistantRequest): Step<AssistantResponse> {
  const invalid = reject({ code: "ai_invalid_output", status: 502 });
  const validated = AssistantResponseSchema.safeParse(parseJson(text));
  if (!validated.success) return invalid;
  const issues = findUnsupportedClaims(validated.data, request.context);
  if (issues.length > 0) {
    console.warn("assistant: rejected model output", issues.length, "issue(s)");
    return invalid;
  }
  const localDate = request.context.observedAt.slice(0, 10);
  return { ok: true, value: humanizeTimestamps(validated.data, localDate) };
}

/** Reports whether AI is configured, without exposing any configuration value. */
export async function GET() {
  return NextResponse.json({ configured: readGeminiConfig() !== null }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const gate = checkGate(req);
  if (gate) return failureResponse(gate);

  const request = await parseRequest(req);
  if (!request.ok) return failureResponse(request.failure);

  const config = readGeminiConfig();
  if (!config) return failureResponse({ code: "ai_not_configured", status: 503 });

  const text = await askModel(request.value, config);
  if (!text.ok) return failureResponse(text.failure);

  const output = validateOutput(text.value, request.value);
  if (!output.ok) return failureResponse(output.failure);

  const body: AssistantApiSuccess = { source: "gemini", model: config.model, response: output.value };
  return NextResponse.json(body, { headers: NO_STORE });
}
