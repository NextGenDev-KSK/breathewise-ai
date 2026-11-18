"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

const CONTROL = "mt-1 block h-11 w-full rounded-lg border bg-surface px-3 text-sm text-ink";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/** Ids for a field's hint and error, joined for aria-describedby. */
function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter((part) => part !== null);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-ink-3 mt-1 text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-danger-700 mt-1 text-xs font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange" | "value"> {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
}

/** A labelled input whose hint and error are announced with it; invalid state is exposed via aria-invalid. */
export function InputField({
  id,
  label,
  value,
  onValueChange,
  hint,
  error,
  className,
  ...rest
}: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, error ? "border-danger-700" : "border-line-strong", className)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
}

/** A labelled select that only ever reports one of its own option values (no unchecked casts). */
export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const chosen = options.find((option) => option.value === e.target.value);
          if (chosen) onChange(chosen.value);
        }}
        aria-describedby={describedBy(id, hint)}
        className={cn(CONTROL, "border-line-strong")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
