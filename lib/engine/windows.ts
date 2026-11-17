import type { AirQualitySnapshot, HourlyPoint } from "@/types/air";
import type { Activity, Household } from "@/types/preferences";
import { hasSensitiveMember } from "@/types/preferences";
import { CONCERN_LABELS, assessConcern, type ConcernLevel } from "@/lib/air/indices";
import { chooseMetric, describeMetricValue, mean, upcomingHours, METRIC_LABELS, type Metric } from "@/lib/engine/analysis";
import { epochToLocalTime, localHour, relativeDayLabel } from "@/lib/time";

export type Intensity = "light" | "moderate" | "vigorous";

export interface ActivityProfile {
  label: string;
  intensity: Intensity;
  durationHours: number;
  /** Local hours (inclusive start, exclusive end) when the activity is realistic. */
  earliestHour: number;
  latestHour: number;
  involvesChildren: boolean;
}

export const ACTIVITY_PROFILES: Record<Activity, ActivityProfile> = {
  walking: { label: "Walking", intensity: "light", durationHours: 1, earliestHour: 5, latestHour: 22, involvesChildren: false },
  jogging: { label: "Jogging", intensity: "vigorous", durationHours: 1, earliestHour: 5, latestHour: 21, involvesChildren: false },
  cycling: { label: "Cycling", intensity: "vigorous", durationHours: 1, earliestHour: 5, latestHour: 21, involvesChildren: false },
  children_play: { label: "Children's outdoor play", intensity: "moderate", durationHours: 1, earliestHour: 7, latestHour: 19, involvesChildren: true },
  commuting: { label: "Commuting", intensity: "light", durationHours: 1, earliestHour: 6, latestHour: 22, involvesChildren: false },
  exercise: { label: "Outdoor exercise", intensity: "vigorous", durationHours: 1, earliestHour: 5, latestHour: 21, involvesChildren: false },
};

export type Verdict = "reasonable" | "reduce" | "avoid" | "unknown";

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
  formatTime?: (localTime: string) => string;
}

function levelForMetric(metric: Metric, value: number): ConcernLevel {
  const a = assessConcern({
    us_aqi: metric === "us_aqi" ? value : null,
    european_aqi: metric === "european_aqi" ? value : null,
    pm2_5: metric === "pm2_5" ? value : null,
  });
  return a?.level ?? 0;
}

function addHours(localTime: string, hours: number): string {
  const h = (localHour(localTime) + hours) % 24;
  return `${localTime.slice(0, 11)}${String(h).padStart(2, "0")}${localTime.slice(13)}`;
}

/** "06:00–07:00", prefixed with the day when the window is not today. */
export function windowRange(slot: WindowSlot, fmt: (t: string) => string): string {
  const range = `${fmt(slot.startTime)}–${fmt(slot.endTime)}`;
  return slot.dayLabel === "Today" ? range : `${slot.dayLabel} ${range}`;
}

/** Decides how strongly to caution, based on level, exertion and who is involved. */
export function decideVerdict(level: ConcernLevel, intensity: Intensity, sensitive: boolean): Verdict {
  if (level >= 4) return "avoid";
  if (level === 3) return intensity === "vigorous" || sensitive ? "avoid" : "reduce";
  if (level === 2) return intensity === "vigorous" || sensitive ? "reduce" : "reasonable";
  if (level === 1) return sensitive && intensity === "vigorous" ? "reduce" : "reasonable";
  return "reasonable";
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
  const fmt = opts.formatTime ?? ((t: string) => t.slice(11));
  const sensitive = hasSensitiveMember(opts.household) || profile.involvesChildren;
  const range = opts.hourRange ?? { start: profile.earliestHour, end: profile.latestHour };
  const start = Math.max(range.start, profile.earliestHour);
  const end = Math.min(range.end, profile.latestHour);

  const hours = upcomingHours(snapshot, opts.nowMs, opts.horizonHours ?? 24)
    .filter((h) => h.epochMs >= opts.nowMs - 30 * 60 * 1000) // windows must start no earlier than ~now
    .filter((h) => {
      const hr = localHour(h.time);
      return hr >= start && hr + profile.durationHours <= end;
    });

  const metric = chooseMetric(hours);
  const nowLocal = epochToLocalTime(opts.nowMs, snapshot.utcOffsetSeconds);
  const base = { activity: opts.activity, profile, metric, metricLabel: metric ? METRIC_LABELS[metric] : null };

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
    const windowHours: HourlyPoint[] = [];
    for (let k = 0; k < profile.durationHours; k++) {
      const next = snapshot.hourly.find((x) => x.epochMs === h.epochMs + k * 3_600_000);
      if (next) windowHours.push(next);
    }
    const values = windowHours.map((x) => x[metric]).filter((v): v is number => v !== null);
    if (values.length < profile.durationHours) {
      skipped++;
      continue;
    }
    const m = mean(values) as number;
    const level = levelForMetric(metric, m);
    slots.push({
      startTime: h.time,
      dayLabel: relativeDayLabel(h.time, nowLocal),
      endTime: addHours(h.time, profile.durationHours),
      startMs: h.epochMs,
      meanValue: m,
      level,
      levelLabel: CONCERN_LABELS[level],
    });
  }

  if (slots.length === 0) {
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

  // Lowest mean wins; ties go to the earliest start.
  const best = slots.reduce((a, b) => (b.meanValue < a.meanValue ? b : a));
  const worst = slots.reduce((a, b) => (b.meanValue > a.meanValue ? b : a));
  const verdict = decideVerdict(best.level, profile.intensity, sensitive);

  const reasons = [
    `Of ${slots.length} candidate start times in the forecast, ${fmt(best.startTime)} has the lowest forecast value (${describeMetricValue(metric, best.meanValue)}, ${best.levelLabel.toLowerCase()} concern).`,
  ];
  if (worst.meanValue > best.meanValue) {
    reasons.push(`The highest forecast value in the same period is ${describeMetricValue(metric, worst.meanValue)} around ${fmt(worst.startTime)}.`);
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
    cautions.push("Children, older adults and people with respiratory sensitivity are generally more affected by polluted air.");
  }

  const uncertaintyNotes: string[] = ["These are model forecasts, not monitoring-station measurements."];
  if (snapshot.model.id === "cams_global") {
    uncertaintyNotes.push("The global model runs in 3-hour steps on a ~45 km grid, so hour-to-hour differences are approximate.");
  }
  const uncertain = skipped > hours.length * 0.2 || slots.length < 3;
  if (uncertain) uncertaintyNotes.push("Several forecast hours are missing, so this recommendation is less certain.");
  if (worst.meanValue - best.meanValue < best.meanValue * 0.1) {
    uncertaintyNotes.push("Forecast values are similar across the period, so timing makes little difference.");
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
