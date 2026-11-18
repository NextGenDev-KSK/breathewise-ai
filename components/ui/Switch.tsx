"use client";

import { useId } from "react";
import { cn } from "@/components/ui/cn";

interface SwitchProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off setting using the ARIA switch pattern, with its explanation linked as the description. */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-ink text-sm font-semibold">
          {label}
        </label>
        <p id={hintId} className="text-ink-3 text-xs">
          {hint}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hintId}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors",
          checked ? "border-brand-700 bg-brand-700" : "border-ink-3 bg-surface",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-5 rounded-full transition-transform",
            checked ? "translate-x-5 bg-white" : "bg-ink-3 translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
