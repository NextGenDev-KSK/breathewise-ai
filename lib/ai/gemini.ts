import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ASSISTANT_RESPONSE_JSON_SCHEMA } from "@/lib/ai/schema";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "@/lib/ai/prompt";
import type { AssistantRequest } from "@/lib/ai/schema";

/** Stable Flash model verified against the Gemini API model list on 2026-11-17. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_TIMEOUT_MS = 20_000;

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
  constructor(readonly kind: "timeout" | "unavailable" | "empty") {
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
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: controller.signal,
        httpOptions: { timeout: timeoutMs },
      },
    });
    const text = result.text;
    if (!text) throw new GeminiError("empty");
    return text;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    if (controller.signal.aborted) throw new GeminiError("timeout");
    throw new GeminiError("unavailable");
  } finally {
    clearTimeout(timer);
  }
}
