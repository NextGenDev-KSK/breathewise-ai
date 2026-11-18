import { describe, expect, it, vi } from "vitest";
import { fetchAssistantStatus } from "@/lib/ai/client";
import { jsonResponse } from "@/tests/fixtures/http";

const respond = (response: Response) => vi.fn().mockResolvedValue(response);

describe("fetchAssistantStatus", () => {
  it("is true only when the server reports a configured model", async () => {
    expect(await fetchAssistantStatus(undefined, respond(jsonResponse({ configured: true })))).toBe(true);
    expect(await fetchAssistantStatus(undefined, respond(jsonResponse({ configured: false })))).toBe(false);
  });

  it("treats unexpected bodies, non-JSON and network failures as not configured", async () => {
    expect(await fetchAssistantStatus(undefined, respond(jsonResponse({ configured: "yes" })))).toBe(false);
    expect(await fetchAssistantStatus(undefined, respond(new Response("<html>", { status: 500 })))).toBe(
      false,
    );
    expect(await fetchAssistantStatus(undefined, vi.fn().mockRejectedValue(new TypeError("offline")))).toBe(
      false,
    );
  });

  it("asks without caching and passes the abort signal through", async () => {
    const fetchImpl = respond(jsonResponse({ configured: true }));
    const controller = new AbortController();
    await fetchAssistantStatus(controller.signal, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("/api/assistant", {
      signal: controller.signal,
      cache: "no-store",
    });
  });
});
