import "@/lib/zodConfig";
import { NextResponse, type NextRequest } from "next/server";
import {
  AssistantRequestSchema,
  AssistantResponseSchema,
  MAX_BODY_BYTES,
  type AssistantApiSuccess,
  type AssistantErrorCode,
} from "@/lib/ai/schema";
import { findUnsupportedClaims } from "@/lib/ai/guard";
import { GeminiError, generateAssistantJson, readGeminiConfig } from "@/lib/ai/gemini";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Leaves headroom above the 30 s Gemini budget so the platform never cuts a request short. */
export const maxDuration = 60;


const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const MESSAGES: Record<AssistantErrorCode, string> = {
  invalid_request: "The request was not valid.",
  payload_too_large: "The request is too large.",
  unsupported_media_type: "Requests must be JSON.",
  rate_limited: "Too many questions in a short time. Please wait a moment.",
  ai_not_configured: "The AI assistant is not configured on this server. Rule-based guidance is available.",
  ai_timeout: "The AI assistant took too long to respond.",
  ai_rate_limited: "The AI service's usage limit was reached. Please try again in a minute.",
  ai_unavailable: "The AI assistant is temporarily unavailable.",
  ai_invalid_output: "The AI response did not pass validation, so it was discarded.",
};

function fail(code: AssistantErrorCode, status: number, extraHeaders: Record<string, string> = {}, message = MESSAGES[code]) {
  return NextResponse.json({ error: code, message }, { status, headers: { ...NO_STORE, ...extraHeaders } });
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

/** Reports whether AI is configured, without exposing any configuration value. */
export async function GET() {
  return NextResponse.json({ configured: readGeminiConfig() !== null }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return fail("unsupported_media_type", 415);

  const rate = limiter(clientKey(req.headers));
  if (!rate.allowed) return fail("rate_limited", 429, { "Retry-After": String(rate.retryAfterSeconds) });

  const raw = await readLimitedBody(req);
  if (raw === null) return fail("payload_too_large", 413);

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("invalid_request", 400, {}, "The request body is not valid JSON.");
  }
  const parsed = AssistantRequestSchema.safeParse(json);
  if (!parsed.success) {
    // Only the first issue's message is returned; never the input itself.
    const first = parsed.error.issues[0];
    const message = first && first.path[0] === "message" ? first.message : MESSAGES.invalid_request;
    return fail("invalid_request", 400, {}, message);
  }

  const config = readGeminiConfig();
  if (!config) return fail("ai_not_configured", 503);

  let text: string;
  try {
    text = await generateAssistantJson(parsed.data, config);
  } catch (err) {
    if (err instanceof GeminiError && err.kind === "timeout") return fail("ai_timeout", 504);
    if (err instanceof GeminiError && err.kind === "rate-limited") return fail("ai_rate_limited", 503, { "Retry-After": "60" });
    // Only the error kind and HTTP status are logged: upstream messages can contain request metadata.
    console.error("assistant: upstream model error", err instanceof GeminiError ? `${err.kind} ${err.status ?? ""}`.trim() : "unknown");
    return fail("ai_unavailable", 502);
  }

  let output: unknown;
  try {
    output = JSON.parse(text);
  } catch {
    return fail("ai_invalid_output", 502);
  }
  const validated = AssistantResponseSchema.safeParse(output);
  if (!validated.success) return fail("ai_invalid_output", 502);
  const issues = findUnsupportedClaims(validated.data, parsed.data.context);
  if (issues.length > 0) {
    console.warn("assistant: rejected model output", issues.length, "issue(s)");
    return fail("ai_invalid_output", 502);
  }

  const body: AssistantApiSuccess = { source: "gemini", model: config.model, response: validated.data };
  return NextResponse.json(body, { headers: NO_STORE });
}
