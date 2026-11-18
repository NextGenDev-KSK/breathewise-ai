import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionForm } from "@/components/assistant/QuestionForm";
import { MAX_MESSAGE_LENGTH } from "@/lib/ai/schema";

function setup(props: { pending?: boolean; error?: string | null } = {}) {
  const onAsk = vi.fn();
  const user = userEvent.setup();
  render(<QuestionForm pending={props.pending ?? false} error={props.error ?? null} onAsk={onAsk} />);
  return { onAsk, user, input: screen.getByLabelText("Your question") };
}

describe("QuestionForm", () => {
  it("sends on Enter and empties the box after a valid question", async () => {
    const { onAsk, user, input } = setup();
    await user.type(input, "Can I cycle now?{Enter}");
    expect(onAsk).toHaveBeenCalledWith("Can I cycle now?");
    expect(input).toHaveValue("");
  });

  it("adds a new line on Shift+Enter instead of sending", async () => {
    const { onAsk, user, input } = setup();
    await user.type(input, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(onAsk).not.toHaveBeenCalled();
    expect(input).toHaveValue("Line one\nLine two");
  });

  it("keeps a blank question in the box so the error can explain it", async () => {
    const { onAsk, user, input } = setup();
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledWith("   ");
    expect(input).toHaveValue("   ");
  });

  it("counts characters against the limit and announces errors on the field", () => {
    const { input } = setup({ error: "Please enter a question." });
    expect(
      screen.getByText(`0/${MAX_MESSAGE_LENGTH} characters. Enter to send, Shift+Enter for a new line.`),
    );
    expect(input).toHaveAttribute("maxlength", String(MAX_MESSAGE_LENGTH));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a question.");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);
  });

  it("disables sending while an answer is pending", () => {
    setup({ pending: true });
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  });
});
