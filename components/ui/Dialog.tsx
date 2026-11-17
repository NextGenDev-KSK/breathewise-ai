"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/components/ui/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Visual placement: centered modal or a left-side drawer. */
  variant?: "modal" | "drawer";
}

/**
 * Accessible modal built on the native <dialog> element: the rest of the page becomes inert,
 * Escape closes it, and focus returns to the element that opened it.
 */
export function Dialog({ open, onClose, title, description, children, className, variant = "modal" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      returnFocus.current?.focus?.();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "bg-surface p-0 text-ink shadow-[var(--shadow-raised)]",
        variant === "modal"
          ? "m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl"
          : "my-0 ml-0 mr-auto h-dvh max-h-dvh w-[min(20rem,85vw)] rounded-none bg-navy-950 text-white",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between gap-4", variant === "modal" ? "border-b border-line px-6 py-4" : "px-5 py-4")}>
        <div>
          <h2 id={titleId} className={cn("text-lg font-semibold", variant === "drawer" && "sr-only")}>
            {title}
          </h2>
          {description ? (
            <p id={descId} className="mt-1 text-sm text-ink-3">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn("grid size-10 place-items-center rounded-lg", variant === "drawer" ? "ml-auto text-navy-200 hover:bg-navy-800" : "text-ink-3 hover:bg-canvas")}
          aria-label="Close"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className={variant === "modal" ? "px-6 py-5" : "px-3 pb-6"}>{children}</div>
    </dialog>
  );
}
