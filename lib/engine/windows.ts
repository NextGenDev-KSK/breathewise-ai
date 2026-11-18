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

/** Forecast hours where the activity could start: from now, within realistic local hours. */
function candidateHours(
  snapshot: AirQualitySnapshot,
  opts: WindowOptions,
  profile: ActivityProfile,
): HourlyPoint[] {
  const range = opts.hourRange ?? { start: profile.earliestHour, end: profile.latestHour };
  const first = Math.max(range.start, profile.earliestHour);
  const last = Math.min(range.end, profile.latestHour);
  return upcomingHours(snapshot, opts.nowMs, opts.horizonHours ?? 24)
    .filter((h) => h.epochMs >= opts.nowMs - 30 * MINUTE_MS) // windows must start no earlier than ~now
    .filter((h) => {
      const hour = localHour(h.time);
      return hour >= first && hour + profile.durationHours <= last;
    });
}

/** Inputs shared by every step of one window search. */
interface SearchContext {
  snapshot: AirQualitySnapshot;
  metric: Metric;
  profile: ActivityProfile;
  nowMs: number;
  fmt: FormatTime;
}

/** The comparatively cleanest and dirtiest slots found. */
interface Extremes {
  best: WindowSlot;
  worst: WindowSlot;
}

interface SlotScan {
  slots: WindowSlot[];
  /** Candidate start hours skipped because part of the window had no data. */
  skipped: number;
}

/** Scores every candidate start; a slot counts only when every hour in it has data. */
function scanSlots({ snapshot, metric, profile, nowMs }: SearchContext, hours: HourlyPoint[]): SlotScan {
  const nowLocal = epochToLocalTime(nowMs, snapshot.utcOffsetSeconds);
  const durationMs = profile.durationHours * HOUR_MS;
  const slots: WindowSlot[] = [];
  let skipped = 0;
  for (const start of hours) {
    const values = metricValues(
      snapshot.hourly.filter((h) => h.epochMs >= start.epochMs && h.epochMs < start.epochMs + durationMs),
      metric,
    );
    const average = mean(values);
    // Gaps are never treated as clean air.
    if (average === null || values.length < profile.durationHours) {
      skipped++;
      continue;
    }
    const level: ConcernLevel = concernLevelFor(metric, average) ?? 0;
    slots.push({
      startTime: start.time,
      dayLabel: relativeDayLabel(start.time, nowLocal),
      endTime: epochToLocalTime(start.epochMs + durationMs, snapshot.utcOffsetSeconds),
      startMs: start.epochMs,
      meanValue: average,
      level,
      levelLabel: CONCERN_LABELS[level],
    });
  }
  return { slots, skipped };
}

function windowReasons(
  { metric, fmt }: SearchContext,
  { best, worst }: Extremes,
  slotCount: number,
): string[] {
  const reasons = [
    `Of ${slotCount} candidate start times in the forecast, ${fmt(best.startTime)} has the lowest forecast value (${describeMetricValue(metric, best.meanValue)}, ${best.levelLabel.toLowerCase()} concern).`,
  ];
  if (worst.meanValue > best.meanValue) {
    reasons.push(
      `The highest forecast value in the same period is ${describeMetricValue(metric, worst.meanValue)} around ${fmt(worst.startTime)}.`,
    );
  }
  return reasons;
}

function windowCautions(
  verdict: Verdict,
  profile: ActivityProfile,
  sensitive: boolean,
  bestLevel: ConcernLevel,
): string[] {
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
  if (sensitive && bestLevel >= 1) {
    cautions.push(
      "Children, older adults and people with respiratory sensitivity are generally more affected by polluted air.",
    );
  }
  return cautions;
}

function windowUncertainty(
  snapshot: AirQualitySnapshot,
  scan: SlotScan,
  candidates: number,
  { best, worst }: Extremes,
) {
  const notes: string[] = [MODEL_LIMITATION];
  if (snapshot.model.id === "cams_global") notes.push(GLOBAL_MODEL_NOTE);
  const uncertain = scan.skipped > candidates * MAX_MISSING_SHARE || scan.slots.length < MIN_SLOTS;
  if (uncertain) notes.push("Several forecast hours are missing, so this recommendation is less certain.");
  if (worst.meanValue - best.meanValue < best.meanValue * SIMILAR_VALUES_SHARE) {
    notes.push("Forecast values are similar across the period, so timing makes little difference.");
  }
  return { uncertain, notes };
}

type ResultBase = Pick<OutdoorWindowResult, "activity" | "profile" | "metric" | "metricLabel">;

function insufficientData(
  base: ResultBase,
  reason: string,
  note: string,
  consideredHours: number,
): OutdoorWindowResult {
  return {
    ...base,
    status: "insufficient-data",
    best: null,
    worst: null,
    verdict: "unknown",
    headline: VERDICT_TEXT.unknown,
    reasons: [reason],
    cautions: [],
    uncertain: true,
    uncertaintyNotes: [note],
    consideredHours,
  };
}

/**
 * Finds the comparatively cleanest contiguous window for an activity in the forecast.
 * "Better" is relative to the other forecast hours; it never means "safe".
 */
export function findOutdoorWindow(snapshot: AirQualitySnapshot, opts: WindowOptions): OutdoorWindowResult {
  const profile = ACTIVITY_PROFILES[opts.activity];
  const fmt = opts.formatTime ?? formatTime24;
  const hours = candidateHours(snapshot, opts, profile);
  const metric = chooseMetric(hours);
  const base: ResultBase = {
    activity: opts.activity,
    profile,
    metric,
    metricLabel: metric ? METRIC_LABELS[metric] : null,
  };

  if (!metric || hours.length === 0) {
    return insufficientData(
      base,
      "The forecast does not cover suitable hours for this activity in the selected period.",
      "No usable forecast values were found for the requested hours.",
      0,
    );
  }

  const ctx: SearchContext = { snapshot, metric, profile, nowMs: opts.nowMs, fmt };
  const scan = scanSlots(ctx, hours);
  // Lowest mean wins; ties go to the earliest start.
  const best = minBy(scan.slots, (slot) => slot.meanValue);
  const worst = maxBy(scan.slots, (slot) => slot.meanValue);
  if (!best || !worst) {
    return insufficientData(
      base,
      "Forecast values are missing for the candidate hours.",
      "Missing forecast values were not treated as zero.",
      hours.length,
    );
  }

  const sensitive = hasSensitiveMember(opts.household) || profile.involvesChildren;
  const verdict = decideVerdict(best.level, profile.intensity, sensitive);
  const extremes: Extremes = { best, worst };
  const { uncertain, notes } = windowUncertainty(snapshot, scan, hours.length, extremes);
  return {
    ...base,
    status: "ok",
    best,
    worst,
    verdict,
    headline:
      verdict === "avoid" ? VERDICT_TEXT.avoid : `${VERDICT_TEXT[verdict]}: ${windowRange(best, fmt)}`,
    reasons: windowReasons(ctx, extremes, scan.slots.length),
    cautions: windowCautions(verdict, profile, sensitive, best.level),
    uncertain,
    uncertaintyNotes: notes,
    consideredHours: scan.slots.length,
  };
}
