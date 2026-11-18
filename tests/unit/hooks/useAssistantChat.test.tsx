import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { AI_DISABLED_NOTICE, FALLBACK_NOTICES } from "@/lib/ai/notices";
import { MAX_MESSAGE_LENGTH } from "@/lib/ai/schema";
import { DEFAULT_SETTINGS } from "@/types/preferences";
import { GOOD_RESPONSE } from "@/tests/fixtures/ai";
import { jsonResponse } from "@/tests/fixtures/http";
import { AppProviders, seedDemoMode, seedStorage } from "@/tests/fixtures/render";

type PostHandler = (init: RequestInit) => Promise<Response>;

const geminiAnswer: PostHandler = async () =>
  jsonResponse({ source: "gemini", model: "gemini-test", response: GOOD_RESPONSE });

/** Stubs GET /api/assistant (status) and POST /api/assistant (answers); returns the POST bodies sent. */
function stubAssistant({
  configured = true,
  post = geminiAnswer,
}: {
  configured?: boolean;
  post?: PostHandler;
}) {
  const posts: { message: string; history: { role: string; text: string }[] }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      if (init.method !== "POST") return jsonResponse({ configured });
      posts.push(JSON.parse(String(init.body)));
      return post(init);
    }),
  );
  return posts;
}

async function renderChat() {
  const hook = renderHook(() => useAssistantChat(), { wrapper: AppProviders });
  await waitFor(() => expect(hook.result.current.snapshot).not.toBeNull());
  return hook;
}

describe("useAssistantChat", () => {
  it("answers with Gemini when configured and sends earlier turns as history", async () => {
    seedDemoMode();
    const posts = stubAssistant({});
    const { result } = await renderChat();
    await waitFor(() => expect(result.current.modeLabel).toBe("Gemini AI, grounded in your local data"));

    act(() => result.current.ask("  Can I walk now?  "));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0]).toMatchObject({
      question: "Can I walk now?",
      answer: GOOD_RESPONSE,
      source: { kind: "gemini", model: "gemini-test" },
    });

    act(() => result.current.ask("And tonight?"));
    await waitFor(() => expect(result.current.turns).toHaveLength(2));
    expect(posts[1]?.history).toEqual([
      { role: "user", text: "Can I walk now?" },
      { role: "assistant", text: GOOD_RESPONSE.summary },
    ]);
  });

  it("falls back to the rule engine with the server's reason when Gemini fails", async () => {
    seedDemoMode();
    stubAssistant({ post: async () => jsonResponse({ error: "ai_rate_limited", message: "Busy" }, 503) });
    const { result } = await renderChat();
    await waitFor(() => expect(result.current.modeLabel).toMatch(/Gemini/));

    act(() => result.current.ask("Is it safe to jog?"));
    await waitFor(() => expect(result.current.turns[0]?.answer).not.toBeNull());
    expect(result.current.turns[0]).toMatchObject({
      source: { kind: "rules" },
      notice: FALLBACK_NOTICES.ai_rate_limited,
    });
  });

  it("never calls Gemini when AI is turned off in Settings, and says why", async () => {
    seedStorage({ settings: { ...DEFAULT_SETTINGS, demoMode: true, onboarded: true, aiEnabled: false } });
    const posts = stubAssistant({});
    const { result } = await renderChat();

    act(() => result.current.ask("Should I open the windows?"));
    expect(result.current.turns[0]).toMatchObject({ source: { kind: "rules" }, notice: AI_DISABLED_NOTICE });
    expect(result.current.turns[0]?.answer?.summary.length).toBeGreaterThan(0);
    expect(posts).toHaveLength(0);
  });

  it("explains the rule-based answer when the server has no Gemini key", async () => {
    seedDemoMode();
    stubAssistant({ configured: false });
    const { result } = await renderChat();
    await waitFor(() => expect(result.current.modeLabel).toMatch(/not configured/));

    act(() => result.current.ask("Can I walk?"));
    expect(result.current.turns[0]?.notice).toBe(FALLBACK_NOTICES.ai_not_configured);
  });

  it("rejects blank and over-long questions without adding a turn", async () => {
    seedDemoMode();
    stubAssistant({});
    const { result } = await renderChat();

    act(() => result.current.ask("   "));
    expect(result.current.error).toBe("Please enter a question.");
    act(() => result.current.ask("x".repeat(MAX_MESSAGE_LENGTH + 1)));
    expect(result.current.error).toBe(`Questions are limited to ${MAX_MESSAGE_LENGTH} characters.`);
    expect(result.current.turns).toHaveLength(0);
  });

  it("drops a superseded question when a newer one is asked, and clears the conversation", async () => {
    seedDemoMode();
    let first = true;
    stubAssistant({
      post: (init) => {
        if (!first) return geminiAnswer(init);
        first = false;
        return new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        );
      },
    });
    const { result } = await renderChat();
    await waitFor(() => expect(result.current.modeLabel).toMatch(/Gemini/));

    act(() => result.current.ask("First question"));
    await waitFor(() => expect(result.current.pending).toBe(true));
    act(() => result.current.ask("Second question"));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.turns.map((t) => t.question)).toEqual(["Second question"]);

    act(() => result.current.clear());
    expect(result.current.turns).toEqual([]);
  });
});
