import type { AirQualitySnapshot, HourlyPoint } from "@/types/air";
import type { Activity, Household } from "@/types/preferences";
import {
  ACTIVITY_PROFILES,
  decideVerdict,
  type ActivityProfile,
  type Verdict,
} from "@/lib/engine/activities";
import { hasSensitiveMember } from "@/types/preferences";
import { CONCERN_LABELS, concernLevelFor, type ConcernLevel } from "@/lib/air/indices";
import { GLOBAL_MODEL_NOTE, MODEL_LIMITATION } from "@/lib/content/notices";
import {
  chooseMetric,
  describeMetricValue,
  metricValues,
  upcomingHours,
  METRIC_LABELS,
  type Metric,
} from "@/lib/engine/analysis";
import { maxBy, mean, minBy } from "@/lib/math";
import {
  epochToLocalTime,
  formatTime24,
  HOUR_MS,
  localHour,
  MINUTE_MS,
  relativeDayLabel,
  type FormatTime,
} from "@/lib/time";

export interface WindowSlot {
  startTime: string;
  /** "Today", "Tomorrow" or a date, relative to the location's current date. */
  dayLabel: string;
  /** Local time the window ends (start + duration). */
  endTime: string;
  startMs: number;
  meanValue: number;
  level: ConcernLevel;
  levelLabel: string;
}

export interface OutdoorWindowResult {
  activity: Activity;
  profile: ActivityProfile;
  status: "ok" | "insufficient-data";
  metric: Metric | null;
  metricLabel: string | null;
  best: WindowSlot | null;
  worst: WindowSlot | null;
  verdict: Verdict;
  headline: string;
  reasons: string[];
  cautions: string[];
  uncertain: boolean;
  uncertaintyNotes: string[];
  consideredHours: number;
}

export interface WindowOptions {
  activity: Activity;
  household: Household;
  nowMs: number;
  horizonHours?: number;
  /** Restrict to these local hours (e.g. a "morning" period). */
  hourRange?: { start: number; end: number };
  /** Formats a local wall-clock string for display; defaults to 24-hour "HH:MM". */
  formatTime?: FormatTime;
}

/** More than this share of candidate hours missing makes a recommendation "uncertain". */
const MAX_MISSING_SHARE = 0.2;
/** Fewer candidate slots than this also makes it "uncertain". */
const MIN_SLOTS = 3;
/** Best and worst within this fraction of each other means timing makes little difference. */
const SIMILAR_VALUES_SHARE = 0.1;

/** "06:00–07:00", prefixed with the day when the window is not today. */
export function windowRange(slot: WindowSlot, fmt: FormatTime): string {
  const range = `${fmt(slot.startTime)}–${fmt(slot.endTime)}`;
  return slot.dayLabel === "Today" ? range : `${slot.dayLabel} ${range}`;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  reasonable: "Comparatively better window",
  reduce: "Better window, but keep it shorter and lighter",
  avoid: "All forecast hours are poor for this activity",
  unknown: "Not enough forecast data",
};

/**
 * Finds the comparatively cleanest contiguous window for an activity in the forecast.
 * "Better" is relative to the other forecast hours; it never means "safe".
 */
export function findOutdoorWindow(snapshot: AirQualitySnapshot, opts: WindowOptions): OutdoorWindowResult {
  const profile = ACTIVITY_PROFILES[opts.activity];
  const fmt = opts.formatTime ?? formatTime24;
  const sensitive = hasSensitiveMember(opts.household) || profile.involvesChildren;
  const range = opts.hourRange ?? { start: profile.earliestHour, end: profile.latestHour };
  const start = Math.max(range.start, profile.earliestHour);
  const end = Math.min(range.end, profile.latestHour);

  const hours = upcomingHours(snapshot, opts.nowMs, opts.horizonHours ?? 24)
    .filter((h) => h.epochMs >= opts.nowMs - 30 * MINUTE_MS) // windows must start no earlier than ~now
    .filter((h) => {
      const hr = localHour(h.time);
      return hr >= start && hr + profile.durationHours <= end;
    });

  const metric = chooseMetric(hours);
  const nowLocal = epochToLocalTime(opts.nowMs, snapshot.utcOffsetSeconds);
  const base = {
    activity: opts.activity,
    profile,
    metric,
    metricLabel: metric ? METRIC_LABELS[metric] : null,
  };

  if (!metric || hours.length === 0) {
    return {
      ...base,
      status: "insufficient-data",
      best: null,
      worst: null,
      verdict: "unknown",
      headline: VERDICT_TEXT.unknown,
      reasons: ["The forecast does not cover suitable hours for this activity in the selected period."],
      cautions: [],
      uncertain: true,
      uncertaintyNotes: ["No usable forecast values were found for the requested hours."],
      consideredHours: 0,
    };
  }

  const slots: WindowSlot[] = [];
  let skipped = 0;
  for (const h of hours) {
    const windowHours: HourlyPoint[] = snapshot.hourly.filter(
      (x) => x.epochMs >= h.epochMs && x.epochMs < h.epochMs + profile.durationHours * HOUR_MS,
    );
    const values = metricValues(windowHours, metric);
    const average = mean(values);
    // A slot counts only when every hour in it has data; gaps are never treated as clean air.
    if (average === null || values.length < profile.durationHours) {
      skipped++;
      continue;
    }
    const level: ConcernLevel = concernLevelFor(metric, average) ?? 0;
    slots.push({
      startTime: h.time,
      dayLabel: relativeDayLabel(h.time, nowLocal),
      endTime: epochToLocalTime(h.epochMs + profile.durationHours * HOUR_MS, snapshot.utcOffsetSeconds),
      startMs: h.epochMs,
      meanValue: average,
      level,
      levelLabel: CONCERN_LABELS[level],
    });
  }

  // Lowest mean wins; ties go to the earliest start.
  const best = minBy(slots, (slot) => slot.meanValue);
  const worst = maxBy(slots, (slot) => slot.meanValue);
  if (!best || !worst) {
    return {
      ...base,
      status: "insufficient-data",
      best: null,
      worst: null,
      verdict: "unknown",
      headline: VERDICT_TEXT.unknown,
      reasons: ["Forecast values are missing for the candidate hours."],
      cautions: [],
      uncertain: true,
      uncertaintyNotes: ["Missing forecast values were not treated as zero."],
      consideredHours: hours.length,
    };
  }

  const verdict = decideVerdict(best.level, profile.intensity, sensitive);

  const reasons = [
    `Of ${slots.length} candidate start times in the forecast, ${fmt(best.startTime)} has the lowest forecast value (${describeMetricValue(metric, best.meanValue)}, ${best.levelLabel.toLowerCase()} concern).`,
  ];
  if (worst.meanValue > best.meanValue) {
    reasons.push(
      `The highest forecast value in the same period is ${describeMetricValue(metric, worst.meanValue)} around ${fmt(worst.startTime)}.`,
    );
  }

  const cautions: string[] = [];
  if (verdict === "avoid") {
    cautions.push(
      profile.intensity === "vigorous"
        ? "Consider an indoor alternative or postponing vigorous exercise; heavier breathing draws in more polluted air."
        : "Consider keeping time outdoors short or choosing an indoor alternative.",
    );
  } else if (verdict === "reduce") {
    cautions.push("Prefer a shorter, lower-intensity session and stop if anyone feels discomfort.");
  }
  if (sensitive && best.level >= 1) {
    cautions.push(
      "Children, older adults and people with respiratory sensitivity are generally more affected by polluted air.",
    );
  }

  const uncertaintyNotes: string[] = [MODEL_LIMITATION];
  if (snapshot.model.id === "cams_global") uncertaintyNotes.push(GLOBAL_MODEL_NOTE);
  const uncertain = skipped > hours.length * MAX_MISSING_SHARE || slots.length < MIN_SLOTS;
  if (uncertain)
    uncertaintyNotes.push("Several forecast hours are missing, so this recommendation is less certain.");
  if (worst.meanValue - best.meanValue < best.meanValue * SIMILAR_VALUES_SHARE) {
    uncertaintyNotes.push(
      "Forecast values are similar across the period, so timing makes little difference.",
    );
  }

  const headline =
    verdict === "avoid" ? VERDICT_TEXT.avoid : `${VERDICT_TEXT[verdict]}: ${windowRange(best, fmt)}`;

  return {
    ...base,
    status: "ok",
    best,
    worst,
    verdict,
    headline,
    reasons,
    cautions,
    uncertain,
    uncertaintyNotes,
    consideredHours: slots.length,
  };
}
