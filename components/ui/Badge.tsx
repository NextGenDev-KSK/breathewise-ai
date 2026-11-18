import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type Tone = "neutral" | "brand" | "info" | "caution" | "danger" | "navy";

const TONES: Record<Tone, string> = {
  neutral: "bg-lvlna-bg text-lvlna-fg border-line",
  brand: "bg-brand-50 text-brand-800 border-brand-100",
  info: "bg-info-50 text-info-800 border-blue-100",
  caution: "bg-caution-50 text-caution-800 border-caution-200",
  danger: "bg-danger-50 text-danger-700 border-red-100",
  navy: "bg-navy-900 text-white border-navy-900",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
