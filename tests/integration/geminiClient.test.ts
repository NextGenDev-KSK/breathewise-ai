import { describe, expect, it, vi } from "vitest";
import { GOOD_RESPONSE, delhiContext } from "../fixtures/ai";

const generateContent = vi.fn();
class ApiError extends Error {
  constructor(readonly status: number) {
    super(`upstream ${status}`);
  }
}
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return { models: { generateContent } };
  }),
  ThinkingLevel: { LOW: "LOW", MINIMAL: "MINIMAL" },
  ApiError,
}));

const { generateAssistantJson, GeminiError } = await import("@/lib/ai/gemini");
const { askGemini } = await import("@/lib/ai/client");

const req = { message: "Can I walk now?", history: [], context: delhiContext() };
const config = { apiKey: "k", model: "gemini-3.8-flash" };

describe("generateAssistantJson (Gemini SDK mocked)", () => {
  it("requests schema-constrained JSON with the system rules and no coordinates", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(GOOD_RESPONSE) });
    const text = await generateAssistantJson(req, config);
    expect(JSON.parse(text).summary).toBe(GOOD_RESPONSE.summary);
    const call = generateContent.mock.calls[0]![0];
    expect(call.model).toBe("gemini-3.8-flash");
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.responseJsonSchema.required).toContain("uncertainties");
    expect(call.config.systemInstruction).toMatch(/Never invent AQI values/);
    expect(call.config.maxOutputTokens).toBeLessThanOrEqual(4096);
    expect(call.config.httpOptions.retryOptions).toMatchObject({ attempts: 3, httpStatusCodes: expect.arrayContaining([429, 503]) });
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.config.thinkingConfig.thinkingLevel).toBe("LOW"); // 3.8 Flash rejects "minimal"
    expect(call.contents).toContain("Can I walk now?");
    expect(call.contents).not.toMatch(/latitude|longitude|28\.65/);
  });

  it("uses minimal thinking for Flash-Lite models", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(GOOD_RESPONSE) });
    await generateAssistantJson(req, { apiKey: "k", model: "gemini-3.5-flash-lite" });
    expect(generateContent.mock.calls.at(-1)![0].config.thinkingConfig.thinkingLevel).toBe("MINIMAL");
  });

  it("maps quota and server errors by upstream status", async () => {
    generateContent.mockRejectedValue(new ApiError(429));
    await expect(generateAssistantJson(req, config)).rejects.toMatchObject({ kind: "rate-limited", status: 429 });
    generateContent.mockRejectedValue(new ApiError(503));
    await expect(generateAssistantJson(req, config)).rejects.toMatchObject({ kind: "unavailable", status: 503 });
  });

  it("maps empty output, failures and timeouts to typed errors", async () => {
    generateContent.mockResolvedValue({ text: "" });
    await expect(generateAssistantJson(req, config)).rejects.toMatchObject({ kind: "empty" });
    generateContent.mockRejectedValue(new Error("API key not valid. key=secret"));
    await expect(generateAssistantJson(req, config)).rejects.toMatchObject({ kind: "unavailable" });
    generateContent.mockImplementation(({ config: c }: { config: { abortSignal: AbortSignal } }) => new Promise((_, reject) => c.abortSignal.addEventListener("abort", () => reject(new Error("aborted")))));
    await expect(generateAssistantJson(req, config, 20)).rejects.toBeInstanceOf(GeminiError);
    await expect(generateAssistantJson(req, config, 20)).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("askGemini (browser client)", () => {
  const ok = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("returns validated responses", async () => {
    const r = await askGemini("q", [], delhiContext(), undefined, ok({ source: "gemini", model: "m", response: GOOD_RESPONSE }));
    expect(r).toMatchObject({ ok: true, model: "m" });
  });
  it("rejects responses that fail client-side validation", async () => {
    const r = await askGemini("q", [], delhiContext(), undefined, ok({ source: "gemini", model: "m", response: { summary: "x" } }));
    expect(r).toMatchObject({ ok: false, code: "ai_invalid_output" });
  });
  it("passes through typed server errors and handles unknown ones", async () => {
    expect(await askGemini("q", [], delhiContext(), undefined, ok({ error: "ai_not_configured", message: "m" }, 503))).toMatchObject({ ok: false, code: "ai_not_configured" });
    expect(await askGemini("q", [], delhiContext(), undefined, ok("<html>", 500))).toMatchObject({ ok: false, code: "unknown" });
  });
  it("reports network failures and rethrows aborts", async () => {
    expect(await askGemini("q", [], delhiContext(), undefined, vi.fn().mockRejectedValue(new TypeError("offline")))).toMatchObject({ ok: false, code: "network" });
    await expect(askGemini("q", [], delhiContext(), undefined, vi.fn().mockRejectedValue(new DOMException("x", "AbortError")))).rejects.toThrow();
  });
});
