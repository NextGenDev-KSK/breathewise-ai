"use client";

import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";

interface ComboboxOptions<T> {
  options: readonly T[];
  /** Called with the active option on Enter. */
  onChoose: (option: T) => void;
  /** Called on Escape when the list is already closed (clears the input). */
  onClear: () => void;
  /** The element that contains the input and list; pointer presses outside it close the list. */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * Open state, active option and keyboard handling for the WAI-ARIA 1.2 combobox pattern:
 * arrow keys move (wrapping), Enter chooses, Escape closes and then clears.
 */
export function useCombobox<T>({ options, onChoose, onClear, containerRef }: ComboboxOptions<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const activeIndex = active < options.length ? active : -1;

  useEffect(() => {
    const closeOnOutsidePointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [containerRef]);

  const move = (step: 1 | -1) =>
    setActive((index) => (options.length ? (index + step + options.length) % options.length : -1));

  const handlers: Record<string, (e: KeyboardEvent<HTMLInputElement>) => void> = {
    ArrowDown: (e) => {
      e.preventDefault();
      setOpen(true);
      move(1);
    },
    ArrowUp: (e) => {
      e.preventDefault();
      move(-1);
    },
    Enter: (e) => {
      const target = options[activeIndex];
      if (!open || target === undefined) return;
      e.preventDefault();
      onChoose(target);
    },
    Escape: (e) => {
      if (!open) return onClear();
      e.preventDefault();
      setOpen(false);
    },
  };

  return {
    open,
    setOpen,
    activeIndex,
    setActive,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => handlers[e.key]?.(e),
  };
}
