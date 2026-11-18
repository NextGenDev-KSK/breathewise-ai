import { Moon, Sun, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import type { PeriodId, PlanPeriod } from "@/lib/engine/plan";
import { describeMetricValue } from "@/lib/engine/analysis";
import type { FormatTime } from "@/lib/time";

const PERIOD_ICONS: Record<PeriodId, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

function PeriodSummary({ period }: { period: PlanPeriod }) {
  const { stats } = period;
  if (!stats) return <p className="text-ink-3 text-xs">No forecast data for this period.</p>;
  return (
    <p className="text-ink-3 text-xs">
      Average {describeMetricValue(stats.metric, stats.mean)}, peak{" "}
      {describeMetricValue(stats.metric, stats.max)}
    </p>
  );
}

/** One period of the clean-air day: header with timing, level and cleanest marker, then its actions. */
export function PlanPeriodCard({
  period,
  cleanest,
  formatTime,
}: {
  period: PlanPeriod;
  cleanest: boolean;
  formatTime: FormatTime;
}) {
  const Icon = PERIOD_ICONS[period.id];
  const range = period.startTime ? `, ${formatTime(period.startTime)}–${formatTime(period.endTime)}` : "";
  return (
    <Card className={cleanest ? "ring-brand-500/40 ring-2" : undefined}>
      <div className="border-line flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <span aria-hidden="true" className="bg-navy-900 grid size-9 place-items-center rounded-lg text-white">
          <Icon className="size-4" />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-semibold">
            {period.label}{" "}
            <span className="text-ink-3 font-normal">
              · {period.dayLabel}
              {range}
            </span>
          </h3>
          <PeriodSummary period={period} />
        </div>
        {period.stats ? <LevelBadge level={period.stats.level} /> : null}
        {cleanest ? (
          <span className="bg-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
            Cleanest period
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {period.items.map((r) => (
          <RecommendationCard key={r.id} rec={r} headingLevel="h4" />
        ))}
      </div>
    </Card>
  );
}
