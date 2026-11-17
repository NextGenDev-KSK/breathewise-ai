import type { ConcernLevel } from "@/lib/air/indices";
import { CONCERN_LABELS } from "@/lib/air/indices";
import { cn } from "@/components/ui/cn";

export const LEVEL_CLASSES: Record<ConcernLevel | "na", { bg: string; fg: string; mark: string }> = {
  0: { bg: "bg-lvl0-bg", fg: "text-lvl0-fg", mark: "bg-lvl0" },
  1: { bg: "bg-lvl1-bg", fg: "text-lvl1-fg", mark: "bg-lvl1" },
  2: { bg: "bg-lvl2-bg", fg: "text-lvl2-fg", mark: "bg-lvl2" },
  3: { bg: "bg-lvl3-bg", fg: "text-lvl3-fg", mark: "bg-lvl3" },
  4: { bg: "bg-lvl4-bg", fg: "text-lvl4-fg", mark: "bg-lvl4" },
  5: { bg: "bg-lvl5-bg", fg: "text-lvl5-fg", mark: "bg-lvl5" },
  na: { bg: "bg-lvlna-bg", fg: "text-lvlna-fg", mark: "bg-lvlna" },
};

/** Level marks also differ in shape (filled squares count), so colour is never the only cue. */
export function LevelBadge({ level, label, className }: { level: ConcernLevel | null; label?: string; className?: string }) {
  const key = level ?? "na";
  const c = LEVEL_CLASSES[key];
  const text = label ?? (level === null ? "Unknown" : CONCERN_LABELS[level]);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", c.bg, c.fg, className)}>
      <span aria-hidden="true" className="flex gap-0.5">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className={cn("h-2 w-1 rounded-sm", level !== null && i < Math.ceil((level + 1) / 2) ? c.mark : "bg-current opacity-20")} />
        ))}
      </span>
      {text}
    </span>
  );
}
