import { describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCombobox } from "@/hooks/useCombobox";

const CITIES = ["Delhi", "Pune", "Chennai"] as const;

/** A minimal combobox: the hook drives it exactly as LocationPicker does. */
function Harness({
  options = CITIES,
  onChoose = vi.fn(),
  onClear = vi.fn(),
}: {
  options?: readonly string[];
  onChoose?: (city: string) => void;
  onClear?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const combobox = useCombobox({ options, onChoose, onClear, containerRef });
  return (
    <>
      <div ref={containerRef}>
        <input aria-label="City" onKeyDown={combobox.onKeyDown} onFocus={() => combobox.setOpen(true)} />
        <p data-testid="state">{`${combobox.open ? "open" : "closed"} ${combobox.activeIndex}`}</p>
      </div>
      <button type="button">Elsewhere</button>
    </>
  );
}

const state = () => screen.getByTestId("state").textContent;

describe("useCombobox", () => {
  it("opens on ArrowDown and moves through options, wrapping at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}{ArrowDown}");
    expect(state()).toBe("open 0");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(state()).toBe("open 2");
    await user.keyboard("{ArrowDown}");
    expect(state()).toBe("open 0");
    await user.keyboard("{ArrowUp}");
    expect(state()).toBe("open 2");
  });

  it("chooses the active option on Enter, but only while the list is open", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChoose={onChoose} />);
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onChoose).not.toHaveBeenCalled(); // nothing active yet
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChoose).toHaveBeenCalledWith("Pune");
    await user.keyboard("{Escape}{Enter}");
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it("closes on the first Escape and clears on the second", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClear={onClear} />);
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");
    expect(state()).toMatch(/^closed/);
    expect(onClear).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("closes when the pointer goes down outside, not inside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("textbox"));
    await user.click(screen.getByTestId("state"));
    expect(state()).toMatch(/^open/);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(state()).toMatch(/^closed/);
  });

  it("opens on ArrowUp at the last option", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}{ArrowUp}");
    expect(state()).toBe("open 2");
  });

  it("has no active option when the list is empty or shrinks below the active index", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    screen.getByRole("textbox").focus();
    await user.keyboard("{ArrowUp}");
    expect(state()).toBe("open 2");
    rerender(<Harness options={["Delhi"]} />);
    expect(state()).toBe("open -1");
    rerender(<Harness options={[]} />);
    await user.keyboard("{ArrowDown}");
    expect(state()).toBe("open -1");
  });

  it("ignores keys it does not handle", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChoose={onChoose} />);
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Tab}");
    expect(onChoose).not.toHaveBeenCalled();
  });
});
