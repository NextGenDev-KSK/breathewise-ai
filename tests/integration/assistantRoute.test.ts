import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { delhiContext, GOOD_RESPONSE } from "@/tests/fixtures/ai";
import type * as GeminiModule from "@/lib/ai/gemini";

const generate = vi.fn<(...args: unknown[]) => Promise<string>>();

vi.mock("@/lib/ai/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof GeminiModule>();
  return { ...actual, generateAssistantJson: (...args: unknown[]) => generate(...args) };
});

const { GET, POST } = await import("@/app/api/assistant/route");
const { GeminiError } = await import("@/lib/ai/gemini");

let ip = 0;
function request(body: unknown, init: { contentType?: string; raw?: string } = {}) {
  ip += 1;
  return new NextRequest("http://localhost/api/assistant", {
    method: "POST",
    headers: { "content-type": init.contentType ?? "application/json", "x-forwarded-for": `10.0.0.${ip}` },
    body: init.raw ?? JSON.stringify(body),
  });
}
const valid = () => ({ message: "Is it a good time to go walking?", context: delhiContext() });

beforeEach(() => {
  generate.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/assistant", () => {
  it("reports configuration without exposing values", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ configured: true });
    expect(JSON.stringify(body)).not.toContain("test-key");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await (await GET()).json()).toEqual({ configured: false });
  });
});

describe("POST /api/assistant", () => {
  it("returns a validated Gemini response", async () => {
    generate.mockResolvedValue(JSON.stringify(GOOD_RESPONSE));
    const res = await POST(request(valid()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.source).toBe("gemini");
    expect(body.model).toBe("gemini-3.5-flash-lite");
    expect(body.response.summary).toBe(GOOD_RESPONSE.summary);
  });

  it("rewrites raw timestamps in model output for display", async () => {
    generate.mockResolvedValue(JSON.stringify({ ...GOOD_RESPONSE, timing: "Best at 2026-11-17T15:00." }));
    const body = await (await POST(request(valid()))).json();
    expect(body.response.timing).toBe("Best at 15:00 today.");
  });

  it("returns 503 ai_not_configured when no key is set (client falls back to rules)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(request(valid()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_not_configured");
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content types", async () => {
    const res = await POST(request(valid(), { contentType: "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("rejects malformed JSON and invalid bodies without echoing input", async () => {
    const bad = await POST(request(null, { raw: "{oops" }));
    expect(bad.status).toBe(400);
    const res = await POST(
      request({ message: "<script>alert(1)</script>".repeat(40), context: delhiContext() }),
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain("<script>");
    expect(text).toContain("limited to 600 characters");
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await POST(request(null, { raw: JSON.stringify({ message: "x", pad: "y".repeat(20_000) }) }));
    expect(res.status).toBe(413);
  });

  it("rejects model output that is not JSON or not schema-valid", async () => {
    generate.mockResolvedValue("Sure! Here is some advice.");
    expect((await POST(request(valid()))).status).toBe(502);
    generate.mockResolvedValue(JSON.stringify({ summary: "only a summary" }));
    const res = await POST(request(valid()));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("ai_invalid_output");
  });

  it("rejects model output with invented numbers or guarantees", async () => {
    generate.mockResolvedValue(JSON.stringify({ ...GOOD_RESPONSE, risk_context: "PM2.5 is 412 µg/m³." }));
    expect((await (await POST(request(valid()))).json()).error).toBe("ai_invalid_output");
    generate.mockResolvedValue(
      JSON.stringify({ ...GOOD_RESPONSE, summary: "Walking now is completely safe." }),
    );
    expect((await (await POST(request(valid()))).json()).error).toBe("ai_invalid_output");
  });

  it("maps timeouts and upstream failures without leaking details", async () => {
    generate.mockRejectedValue(new GeminiError("timeout"));
    expect((await POST(request(valid()))).status).toBe(504);
    generate.mockRejectedValue(new GeminiError("unavailable"));
    const res = await POST(request(valid()));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toMatch(/stack|test-key|Error:/);
  });

  it("reports an exhausted AI quota distinctly, with Retry-After", async () => {
    generate.mockRejectedValue(new GeminiError("rate-limited", 429));
    const res = await POST(request(valid()));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await res.json()).error).toBe("ai_rate_limited");
  });

  it("passes only validated data to the model (no coordinates)", async () => {
    generate.mockResolvedValue(JSON.stringify(GOOD_RESPONSE));
    await POST(request({ ...valid(), context: { ...delhiContext(), latitude: 28.65 } }));
    const sent = JSON.stringify(generate.mock.calls[0]![0]);
    expect(sent).not.toContain("latitude");
  });

  it("rate-limits bursts from one client", async () => {
    generate.mockResolvedValue(JSON.stringify(GOOD_RESPONSE));
    const burst = () =>
      POST(
        new NextRequest("http://localhost/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify(valid()),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await burst()).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("same-origin protection", () => {
  const post = (headers: Record<string, string>) =>
    POST(
      new NextRequest("http://localhost/api/assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}`,
          ...headers,
        },
        body: JSON.stringify(valid()),
      }),
    );

  it("rejects cross-site browser requests with 403", async () => {
    const res = await post({ "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden_origin");
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin when Sec-Fetch-Site is absent", async () => {
    expect((await post({ origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ origin: "not a url" })).status).toBe(403);
  });

  it("allows same-origin browser requests", async () => {
    generate.mockResolvedValue(JSON.stringify(GOOD_RESPONSE));
    expect((await post({ "sec-fetch-site": "same-origin" })).status).toBe(200);
    expect((await post({ origin: "http://localhost" })).status).toBe(200);
  });
});
