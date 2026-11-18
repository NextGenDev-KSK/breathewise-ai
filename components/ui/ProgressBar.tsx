import { cn } from "@/components/ui/cn";

/** Accessible progress bar: exposes value and range to assistive technology. */
export function ProgressBar({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className?: string;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className={cn("bg-canvas h-2 overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="bg-brand-600 h-full rounded-full transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}
