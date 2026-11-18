import type { AirQualitySnapshot } from "@/types/air";
import { hasSensitiveMember, type Preferences } from "@/types/preferences";
import type { Recommendation } from "@/types/recommendation";
import { GLOBAL_MODEL_NOTE, MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE } from "@/lib/content/notices";
import { chooseMetric, dominantPollutant } from "@/lib/engine/analysis";
import { baseConfidence, sourceLabel } from "@/lib/engine/provenance";
import { maxBy, minBy } from "@/lib/math";
import { epochToLocalTime, formatTime24, HOUR_MS, relativeDayLabel, type FormatTime } from "@/lib/time";
import { PERIOD_BUILDERS } from "@/lib/engine/plan/builders";
import type { PlanContext } from "@/lib/engine/plan/context";
import {
  collectPeriods,
  PERIOD_ORDER,
  PERIODS,
  statsFor,
  type PeriodId,
  type PeriodStats,
} from "@/lib/engine/plan/periods";

export { collectPeriods, periodOfHour, type PeriodId, type PeriodStats } from "@/lib/engine/plan/periods";

export interface PlanPeriod {
  id: PeriodId;
  label: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  stats: PeriodStats | null;
  items: Recommendation[];
}

export interface DailyPlan {
  generatedAtMs: number;
  dataTime: string;
  headline: string;
  cleanestPeriod: PeriodId | null;
  periods: PlanPeriod[];
  notes: string[];
}

function planHeadline(periods: readonly PlanPeriod[]): { headline: string; cleanest: PlanPeriod | null } {
  const cleanest = minBy(periods, (p) => p.stats?.mean ?? null);
  const worst = maxBy(periods, (p) => p.stats?.mean ?? null);
  if (!cleanest?.stats || !worst?.stats) {
    return {
      headline: "Not enough forecast data to plan the day. General indoor-air advice is shown.",
      cleanest: null,
    };
  }
  const headline =
    cleanest.stats.level >= 3
      ? `Air is forecast to be poor all day. ${cleanest.label} is comparatively the least polluted period.`
      : `${cleanest.label} is forecast to be the cleanest period (${cleanest.stats.levelLabel.toLowerCase()} concern); ${worst.label.toLowerCase()} the most polluted (${worst.stats.levelLabel.toLowerCase()}).`;
  return { headline, cleanest };
}

function planNotes(snapshot: AirQualitySnapshot): string[] {
  const notes = [MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE];
  if (snapshot.model.id === "cams_global") notes.push(GLOBAL_MODEL_NOTE);
  if (snapshot.origin === "demo") {
    notes.unshift("This plan uses SAMPLE data for demonstration. It does not describe real conditions.");
  }
  return notes;
}

/**
 * Builds a four-part day plan (morning, afternoon, evening, night) for the next occurrence
 * of each period, using forecast data and the user's saved preferences.
 */
export function buildDailyPlan(
  snapshot: AirQualitySnapshot,
  prefs: Preferences,
  nowMs: number,
  formatTime: FormatTime = formatTime24,
): DailyPlan {
  const grouped = collectPeriods(snapshot, nowMs);
  const metric = chooseMetric(Object.values(grouped).flat());
  const ctx: PlanContext = {
    snapshot,
    prefs,
    nowMs,
    nowLocal: epochToLocalTime(nowMs, snapshot.utcOffsetSeconds),
    fmt: formatTime,
    source: sourceLabel(snapshot),
    confidence: baseConfidence(snapshot, nowMs),
    dominant: dominantPollutant(snapshot),
    sensitive: hasSensitiveMember(prefs.household),
  };

  const periods: PlanPeriod[] = PERIOD_ORDER.map((id) => {
    const hours = grouped[id];
    const label = PERIODS[id].label;
    const stats = statsFor(hours, metric);
    const items = PERIOD_BUILDERS[id](ctx, { id, label, hours, stats, metric })
      .filter((item): item is Recommendation => item !== null)
      .sort((a, b) => a.priority - b.priority);
    const first = hours[0];
    const last = hours.at(-1);
    return {
      id,
      label,
      dayLabel: first ? relativeDayLabel(first.time, ctx.nowLocal) : "",
      startTime: first?.time ?? "",
      endTime: last ? epochToLocalTime(last.epochMs + HOUR_MS, snapshot.utcOffsetSeconds) : "",
      stats,
      items,
    };
  });

  // Chronological order: at 22:30, tonight comes before tomorrow morning. Periods without data go last.
  periods.sort((a, b) => (a.startTime || "9999").localeCompare(b.startTime || "9999"));
  const { headline, cleanest } = planHeadline(periods);

  return {
    generatedAtMs: nowMs,
    dataTime: snapshot.current.time,
    headline,
    cleanestPeriod: cleanest?.id ?? null,
    periods,
    notes: planNotes(snapshot),
  };
}
