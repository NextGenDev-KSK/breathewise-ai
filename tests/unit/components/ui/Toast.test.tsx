import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function Trigger({ message, tone }: { message: string; tone?: "info" | "success" | "error" }) {
  const toast = useToast();
  return <button onClick={() => toast(message, tone)}>{`Show ${message}`}</button>;
}

const renderToasts = (...items: { message: string; tone?: "info" | "success" | "error" }[]) =>
  render(
    <ToastProvider>
      {items.map((item) => (
        <Trigger key={item.message} {...item} />
      ))}
    </ToastProvider>,
  );

afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("announces info politely and errors assertively", async () => {
    const user = userEvent.setup();
    renderToasts({ message: "Saved", tone: "success" }, { message: "Failed", tone: "error" });
    await user.click(screen.getByRole("button", { name: "Show Saved" }));
    await user.click(screen.getByRole("button", { name: "Show Failed" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });

  it("can be dismissed, and dismisses itself (errors stay longer)", async () => {
    vi.useFakeTimers();
    renderToasts({ message: "Saved" }, { message: "Failed", tone: "error" });
    act(() => screen.getByRole("button", { name: "Show Saved" }).click());
    act(() => screen.getByRole("button", { name: "Show Failed" }).click());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Dismiss notification" }).click());
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("keeps at most three toasts on screen", async () => {
    const user = userEvent.setup();
    renderToasts({ message: "One" }, { message: "Two" }, { message: "Three" }, { message: "Four" });
    for (const name of ["One", "Two", "Three", "Four"]) {
      await user.click(screen.getByRole("button", { name: `Show ${name}` }));
    }
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dismiss notification" })).toHaveLength(3);
  });

  it("fails loudly when used outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useToast())).toThrow("useToast must be used inside <ToastProvider>");
  });
});
