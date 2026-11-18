import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import type { Recommendation } from "@/types/recommendation";
import type { DominantPollutant, Metric } from "@/lib/engine/analysis";
import { describeMetricValue } from "@/lib/engine/analysis";
import { MODEL_LIMITATION } from "@/lib/content/notices";
import type { FormatTime } from "@/lib/time";
import type { PeriodId, PeriodStats } from "@/lib/engine/plan/periods";
import type { HourlyPoint } from "@/types/air";

/** Everything a period builder needs, computed once per plan. */
export interface PlanContext {
  snapshot: AirQualitySnapshot;
  prefs: Preferences;
  nowMs: number;
  /** "Now" as a location-local wall-clock string. */
  nowLocal: string;
  fmt: FormatTime;
  source: string;
  confidence: Recommendation["confidence"];
  dominant: DominantPollutant | null;
  sensitive: boolean;
}

/** The data for one period of the plan. */
export interface PeriodInput {
  id: PeriodId;
  label: string;
  hours: HourlyPoint[];
  stats: PeriodStats | null;
  metric: Metric | null;
}

/** A plan item before defaults are applied; `key` becomes part of the item id. */
export type ItemInput = Omit<Recommendation, "id" | "source" | "confidence" | "limitations" | "priority"> &
  Partial<Pick<Recommendation, "confidence" | "limitations" | "priority" | "source">> & { key: string };

/** Builds a plan item with the plan's default source, confidence, caveat and priority. */
export function makeItem(ctx: PlanContext, period: PeriodId, input: ItemInput): Recommendation {
  const { key, ...rest } = input;
  return {
    id: `${period}-${key}`,
    source: ctx.source,
    confidence: ctx.confidence,
    limitations: [MODEL_LIMITATION],
    priority: 3,
    ...rest,
  };
}

/** Average and peak for a period, used as the "data behind it" of period-level items. */
export function evidenceFor(stats: PeriodStats | null, label: string): string[] {
  if (!stats) return [`${label}: no forecast values available`];
  return [
    `${label} average: ${describeMetricValue(stats.metric, stats.mean)} (${stats.levelLabel.toLowerCase()} concern)`,
    `${label} peak: ${describeMetricValue(stats.metric, stats.max)}`,
  ];
}
