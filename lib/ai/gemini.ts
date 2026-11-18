import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ASSISTANT_RESPONSE_JSON_SCHEMA } from "@/lib/ai/schema";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "@/lib/ai/prompt";
import type { AssistantRequest } from "@/lib/ai/schema";

/**
 * Default: Google's low-latency stable Flash-Lite model (verified 2026-11-18). It supports
 * structured output and "minimal" thinking. Live testing showed gemini-3.8-flash, whose lowest
 * thinking level is "low", taking 13–30 s per answer. Set GEMINI_MODEL to use another model.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Flash-Lite models accept "minimal" thinking; other Gemini 3 Flash models reject it, so they use "low". */
export function thinkingLevelFor(model: string): ThinkingLevel {
  return model.includes("flash-lite") ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
}
/** Overall budget for one answer, including SDK retries. The route allows 60 s. */
export const GEMINI_TIMEOUT_MS = 30_000;

/** Bounded retries for quota (429) and transient server errors, with short backoff. */
export const GEMINI_RETRY = { attempts: 3, initialDelay: 1, maxDelay: 4, expBase: 2, httpStatusCodes: [429, 500, 502, 503, 504] };

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

/** Reads server-side configuration. Returns null when no key is configured. */
export function readGeminiConfig(env: NodeJS.ProcessEnv = process.env): GeminiConfig | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = env.GEMINI_MODEL?.trim();
  // Model names are restricted to a safe character set so env typos cannot inject paths.
  const safeModel = model && /^[a-z0-9][a-z0-9.\-]{1,60}$/i.test(model) ? model : DEFAULT_GEMINI_MODEL;
  return { apiKey, model: safeModel };
}

export class GeminiError extends Error {
  constructor(
    readonly kind: "timeout" | "rate-limited" | "unavailable" | "empty",
    /** Upstream HTTP status, when known. Safe to log: it contains no user data. */
    readonly status?: number,
  ) {
    super(`Gemini request failed: ${kind}`);
    this.name = "GeminiError";
  }
}

/** Calls Gemini and returns the raw JSON text. Validation happens in the caller. */
export async function generateAssistantJson(
  req: AssistantRequest,
  config: GeminiConfig,
  timeoutMs = GEMINI_TIMEOUT_MS,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await ai.models.generateContent({
      model: config.model,
      contents: buildUserPrompt(req),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: ASSISTANT_RESPONSE_JSON_SCHEMA,
        maxOutputTokens: 1400,
        thinkingConfig: { thinkingLevel: thinkingLevelFor(config.model) },
        // Our own signal enforces the overall budget, so a timeout is always reported as one.
        abortSignal: controller.signal,
        httpOptions: { retryOptions: GEMINI_RETRY },
      },
    });
    const text = result.text;
    if (!text) throw new GeminiError("empty");
    return text;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    if (controller.signal.aborted) throw new GeminiError("timeout");
    if (err instanceof ApiError) throw new GeminiError(err.status === 429 ? "rate-limited" : "unavailable", err.status);
    throw new GeminiError("unavailable");
  } finally {
    clearTimeout(timer);
  }
}
