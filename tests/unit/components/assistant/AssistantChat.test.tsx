import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { renderWithApp, seedDemoMode } from "@/tests/fixtures/render";
import { jsonResponse } from "@/tests/fixtures/http";

describe("AssistantChat", () => {
  it("answers in rule-based mode when Gemini is not configured, and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).startsWith("/api/assistant")
          ? jsonResponse({ configured: false })
          : new Response("{}", { status: 500 }),
      ),
    );
    seedDemoMode();
    const user = userEvent.setup();
    renderWithApp(<AssistantChat />);
    expect(await screen.findByText(/Rule-based mode: Gemini is not configured/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Is it a good time to go walking?" }));
    expect(await screen.findByText("Rule-based answer (no AI used)")).toBeInTheDocument();
    expect(screen.getByText(/Gemini is not configured on this server/)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE data/)).toBeInTheDocument();
  });

  it("validates input length and emptiness", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ configured: false })),
    );
    const user = userEvent.setup();
    renderWithApp(<AssistantChat />);
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Please enter a question.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveAttribute("aria-invalid", "true");
  });
});
