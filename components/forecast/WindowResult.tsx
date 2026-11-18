import { Info, TriangleAlert } from "lucide-react";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { cn } from "@/components/ui/cn";
import type { Verdict } from "@/lib/engine/activities";
import { windowRange, type OutdoorWindowResult } from "@/lib/engine/windows";
import type { FormatTime } from "@/lib/time";

const VERDICT_STYLE: Record<Verdict, string> = {
  reasonable: "border-brand-100 bg-brand-50",
  reduce: "border-caution-200 bg-caution-50",
  avoid: "border-red-200 bg-danger-50",
  unknown: "border-line bg-canvas",
};

/** The better-window answer with its reasons, cautions and uncertainty; never calls a time "safe". */
export function WindowResult({
  result,
  formatTime,
}: {
  result: OutdoorWindowResult;
  formatTime: FormatTime;
}) {
  const { best, verdict } = result;
  return (
    <section
      aria-label="Outdoor window result"
      className={cn("rounded-xl border p-4", VERDICT_STYLE[verdict])}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-ink text-base font-semibold">{result.headline}</h3>
        {best ? <LevelBadge level={best.level} /> : null}
      </div>
      {best && verdict !== "avoid" ? (
        <p className="text-ink-2 mt-1 text-sm">
          Comparatively better than other forecast hours. This does not mean the air is clean or risk-free.
        </p>
      ) : null}
      {best && verdict === "avoid" ? (
        <p className="text-ink-2 mt-1 text-sm">
          If you do go, {windowRange(best, formatTime)} is comparatively lower.
        </p>
      ) : null}
      <ul className="text-ink-2 mt-3 list-disc space-y-1 pl-5 text-sm">
        {result.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {result.cautions.length ? (
        <div className="text-caution-800 mt-3 flex gap-2 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{result.cautions.join(" ")}</p>
        </div>
      ) : null}
      <div className="text-ink-3 mt-3 flex gap-2 text-xs">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <p>
          {result.uncertain ? <strong className="text-ink-2">Uncertain recommendation. </strong> : null}
          {result.uncertaintyNotes.join(" ")} Based on {result.metricLabel ?? "available data"}; no
          route-specific data is used.
        </p>
      </div>
    </section>
  );
}
