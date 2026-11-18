"use client";

import { useId } from "react";
import { cn } from "@/components/ui/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
  /** Keep the legend for screen readers only, when the surrounding heading already names the control. */
  hideLegend?: boolean;
}

/** A single-choice control built on native radio inputs (arrow keys, form semantics, screen readers). */
export function SegmentedControl<T extends string>({
  legend,
  value,
  options,
  onChange,
  hint,
  hideLegend = false,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className={cn("text-ink text-sm font-semibold", hideLegend && "sr-only")}>{legend}</legend>
      {hint ? <p className="text-ink-3 text-xs">{hint}</p> : null}
      <div className={cn("bg-canvas inline-flex flex-wrap gap-1 rounded-xl p-1", !hideLegend && "mt-2")}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "has-[:focus-visible]:outline-info-700 flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3",
                selected ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
