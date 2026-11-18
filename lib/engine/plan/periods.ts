import type { AirQualitySnapshot, HourlyPoint } from "@/types/air";
import { CONCERN_LABELS, concernLevelFor, type ConcernLevel } from "@/lib/air/indices";
import { metricValues, METRIC_LABELS, type Metric } from "@/lib/engine/analysis";
import { mean, minBy } from "@/lib/math";
import { HOUR_MS, localHour } from "@/lib/time";

export type PeriodId = "morning" | "afternoon" | "evening" | "night";

export interface PeriodDefinition {
  label: string;
  /** Local start hour (inclusive). */
  start: number;
  /** Local end hour (exclusive); night runs past midnight, so its end is 30 (06:00 next day). */
  end: number;
}

export const PERIODS: Record<PeriodId, PeriodDefinition> = {
  morning: { label: "Morning", start: 6, end: 12 },
  afternoon: { label: "Afternoon", start: 12, end: 17 },
  evening: { label: "Evening", start: 17, end: 22 },
  night: { label: "Night", start: 22, end: 30 },
};

export const PERIOD_ORDER: readonly PeriodId[] = ["morning", "afternoon", "evening", "night"];

/** How far ahead the plan looks for the next occurrence of each period. */
const PLAN_HORIZON_HOURS = 30;
/** A period already in progress is planned only if at least this many hours of it remain. */
const MIN_REMAINING_HOURS = 2;

/** The day period an hour belongs to (night spans 22:00–06:00). */
export function periodOfHour(hour: number): PeriodId {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Groups the next ~30 hours into the next occurrence of each period. A period that is
 * almost over (e.g. 05:00 at the end of the night) is skipped in favour of its next occurrence.
 */
export function collectPeriods(snapshot: AirQualitySnapshot, nowMs: number): Record<PeriodId, HourlyPoint[]> {
  const grouped: Record<PeriodId, HourlyPoint[]> = { morning: [], afternoon: [], evening: [], night: [] };
  const hours = snapshot.hourly.filter(
    (h) => h.epochMs >= nowMs - HOUR_MS + 1 && h.epochMs <= nowMs + PLAN_HORIZON_HOURS * HOUR_MS,
  );

  // Split into contiguous runs of the same period.
  const runs: { id: PeriodId; hours: HourlyPoint[] }[] = [];
  for (const hour of hours) {
    const id = periodOfHour(localHour(hour.time));
    const last = runs.at(-1);
    if (last?.id === id) last.hours.push(hour);
    else runs.push({ id, hours: [hour] });
  }

  runs.forEach((run, index) => {
    if (grouped[run.id].length > 0) return; // already have this period's next occurrence
    const almostOver = index === 0 && run.hours.length < MIN_REMAINING_HOURS;
    const recursLater = runs.some((other, j) => j > 0 && other.id === run.id);
    if (almostOver && recursLater) return;
    grouped[run.id] = run.hours;
  });
  return grouped;
}

export interface PeriodStats {
  metric: Metric;
  metricLabel: string;
  mean: number;
  max: number;
  level: ConcernLevel;
  levelLabel: string;
  /** Fraction of the period's hours that have data. */
  coverage: number;
}

/** Mean, peak and concern level of a metric over a period's hours; null when there is no data. */
export function statsFor(hours: readonly HourlyPoint[], metric: Metric | null): PeriodStats | null {
  if (!metric || hours.length === 0) return null;
  const values = metricValues(hours, metric);
  const average = mean(values);
  if (average === null) return null;
  const level = concernLevelFor(metric, average) ?? 0;
  return {
    metric,
    metricLabel: METRIC_LABELS[metric],
    mean: average,
    max: Math.max(...values),
    level,
    levelLabel: CONCERN_LABELS[level],
    coverage: values.length / hours.length,
  };
}

/** The hour with the lowest value of the metric, or null when no hour has data. */
export function lowestHour(hours: readonly HourlyPoint[], metric: Metric | null): HourlyPoint | null {
  return metric ? minBy(hours, (hour) => hour[metric]) : null;
}

/** True when a period's forecast is in the elevated concern range or worse. */
export function isElevated(stats: PeriodStats | null): stats is PeriodStats {
  return stats !== null && stats.level >= 2;
}
