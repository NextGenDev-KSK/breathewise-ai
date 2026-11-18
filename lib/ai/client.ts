import {
  AssistantApiErrorSchema,
  AssistantApiSuccessSchema,
  type AssistantContext,
  type AssistantErrorCode,
  type AssistantResponse,
} from "@/lib/ai/schema";

/** Why an AI answer was not available: a server error code, or a client-side failure. */
export type AskFailureCode = AssistantErrorCode | "network" | "unknown";

export type AskResult =
  | { ok: true; response: AssistantResponse; model: string }
  | { ok: false; reason: string; code: AskFailureCode };

export interface AskOptions {
  message: string;
  history: { role: "user" | "assistant"; text: string }[];
  context: AssistantContext;
  signal?: AbortSignal;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** Calls the server endpoint and re-validates the response before it can be rendered. */
export async function askGemini({
  message,
  history,
  context,
  signal,
  fetchImpl = fetch,
}: AskOptions): Promise<AskResult> {
  let res: Response;
  try {
    res = await fetchImpl("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, context }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { ok: false, code: "network", reason: "The assistant service could not be reached." };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const parsed = AssistantApiSuccessSchema.safeParse(body);
    if (parsed.success) return { ok: true, response: parsed.data.response, model: parsed.data.model };
    return { ok: false, code: "ai_invalid_output", reason: "The AI response did not pass validation." };
  }
  const err = AssistantApiErrorSchema.safeParse(body);
  return err.success
    ? { ok: false, code: err.data.error, reason: err.data.message }
    : { ok: false, code: "unknown", reason: `The assistant returned status ${res.status}.` };
}

export async function fetchAssistantStatus(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/api/assistant", { signal, cache: "no-store" });
    const body = (await res.json()) as { configured?: unknown };
    return body.configured === true;
  } catch {
    return false;
  }
}
