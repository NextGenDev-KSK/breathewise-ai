import type { AirQualitySnapshot, HourlyPoint } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import { hasSensitiveMember } from "@/types/preferences";
import type { Recommendation } from "@/types/recommendation";
import { CONCERN_LABELS, assessConcern, type ConcernLevel } from "@/lib/air/indices";
import { chooseMetric, describeMetricValue, dominantPollutant, isStale, mean, METRIC_LABELS, type Metric } from "@/lib/engine/analysis";
import { findOutdoorWindow } from "@/lib/engine/windows";
import { NO_INDOOR_SENSOR_NOTE } from "@/lib/engine/indoor";
import { EMISSION_FACTORS, EMISSION_SOURCE } from "@/lib/engine/emissions";
import { MODEL_LIMITATION } from "@/lib/engine/recommendations";
import { clockToMinutes, epochToLocalTime, localHour, relativeDayLabel } from "@/lib/time";

export type PeriodId = "morning" | "afternoon" | "evening" | "night";

export const PERIODS: Record<PeriodId, { label: string; start: number; end: number }> = {
  morning: { label: "Morning", start: 6, end: 12 },
  afternoon: { label: "Afternoon", start: 12, end: 17 },
  evening: { label: "Evening", start: 17, end: 22 },
  night: { label: "Night", start: 22, end: 30 }, // 22:00–06:00
};
const ORDER: PeriodId[] = ["morning", "afternoon", "evening", "night"];

export function periodOfHour(hour: number): PeriodId {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export interface PeriodStats {
  metric: Metric;
  metricLabel: string;
  mean: number;
  max: number;
  level: ConcernLevel;
  levelLabel: string;
  coverage: number; // fraction of hours with data
}

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

function levelOf(metric: Metric, v: number): ConcernLevel {
  return (
    assessConcern({ us_aqi: metric === "us_aqi" ? v : null, european_aqi: metric === "european_aqi" ? v : null, pm2_5: metric === "pm2_5" ? v : null })?.level ?? 0
  );
}

/** A period already in progress is planned only if at least this many hours of it remain. */
const MIN_REMAINING_HOURS = 2;

/**
 * Groups the next ~30 hours into the next occurrence of each period. A period that is
 * almost over (e.g. 05:00 at the end of the night) is skipped in favour of its next occurrence.
 */
export function collectPeriods(snapshot: AirQualitySnapshot, nowMs: number): Record<PeriodId, HourlyPoint[]> {
  const out: Record<PeriodId, HourlyPoint[]> = { morning: [], afternoon: [], evening: [], night: [] };
  const hours = snapshot.hourly.filter((h) => h.epochMs >= nowMs - 3_600_000 + 1 && h.epochMs <= nowMs + 30 * 3_600_000);

  // Split into contiguous runs of the same period.
  const runs: { id: PeriodId; hours: HourlyPoint[] }[] = [];
  for (const h of hours) {
    const id = periodOfHour(localHour(h.time));
    const last = runs[runs.length - 1];
    if (last && last.id === id) last.hours.push(h);
    else runs.push({ id, hours: [h] });
  }
  runs.forEach((run, i) => {
    if (out[run.id].length > 0) return; // already have this period's next occurrence
    const almostOver = i === 0 && run.hours.length < MIN_REMAINING_HOURS;
    if (almostOver && runs.some((r, j) => j > 0 && r.id === run.id)) return;
    out[run.id] = run.hours;
  });
  return out;
}

function statsFor(hours: HourlyPoint[], metric: Metric | null): PeriodStats | null {
  if (!metric || hours.length === 0) return null;
  const vals = hours.map((h) => h[metric]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const m = mean(vals) as number;
  const level = levelOf(metric, m);
  return { metric, metricLabel: METRIC_LABELS[metric], mean: m, max: Math.max(...vals), level, levelLabel: CONCERN_LABELS[level], coverage: vals.length / hours.length };
}

function lowestHour(hours: HourlyPoint[], metric: Metric | null): HourlyPoint | null {
  if (!metric) return null;
  let best: HourlyPoint | null = null;
  for (const h of hours) {
    const v = h[metric];
    if (v !== null && (best === null || v < (best[metric] as number))) best = h;
  }
  return best;
}

interface Ctx {
  snapshot: AirQualitySnapshot;
  prefs: Preferences;
  nowMs: number;
  fmt: (t: string) => string;
  source: string;
  baseConfidence: Recommendation["confidence"];
}

function rec(ctx: Ctx, period: PeriodId, r: Omit<Recommendation, "id" | "source" | "confidence" | "limitations" | "priority"> & Partial<Pick<Recommendation, "confidence" | "limitations" | "priority" | "source">> & { key: string }): Recommendation {
  const { key, ...rest } = r;
  return {
    id: `${period}-${key}`,
    source: ctx.source,
    confidence: ctx.baseConfidence,
    limitations: [MODEL_LIMITATION],
    priority: 3,
    ...rest,
  };
}

function evidenceFor(stats: PeriodStats | null, label: string): string[] {
  if (!stats) return [`${label}: no forecast values available`];
  return [`${label} average: ${describeMetricValue(stats.metric, stats.mean)} (${stats.levelLabel.toLowerCase()} concern)`, `${label} peak: ${describeMetricValue(stats.metric, stats.max)}`];
}

function activityItem(ctx: Ctx, period: PeriodId, hours: HourlyPoint[]): Recommendation | null {
  const { prefs } = ctx;
  if (prefs.outdoorActivity === "none" || prefs.outdoorActivity === "commuting") return null;
  const wanted = prefs.preferredActivityTime;
  if (wanted !== "flexible" && wanted !== period) return null;
  const range = PERIODS[period];
  const firstEpoch = hours[0]?.epochMs ?? ctx.nowMs;
  const w = findOutdoorWindow(ctx.snapshot, {
    activity: prefs.outdoorActivity,
    household: prefs.household,
    nowMs: Math.max(ctx.nowMs, firstEpoch),
    horizonHours: 12,
    hourRange: { start: range.start, end: Math.min(range.end, 24) },
    formatTime: ctx.fmt,
  });
  if (w.status !== "ok" || !w.best) return null;
  const when = `${ctx.fmt(w.best.startTime)}–${ctx.fmt(w.best.endTime)}`;
  return rec(ctx, period, {
    key: "activity",
    category: "outdoor",
    title: w.verdict === "avoid" ? `Swap ${w.profile.label.toLowerCase()} for an indoor alternative` : `${w.profile.label} at ${when}`,
    description:
      w.verdict === "avoid"
        ? `All ${period} hours are in a concerning range. If you do go out, ${when} is comparatively lower.`
        : w.verdict === "reduce"
          ? `Comparatively the cleanest ${period} slot, but keep it shorter and lighter than usual.`
          : `Comparatively the cleanest ${period} slot for this activity.`,
    reason: w.reasons[0] ?? "",
    evidence: [`${describeMetricValue(w.metric ?? "pm2_5", w.best.meanValue)} forecast at ${ctx.fmt(w.best.startTime)}`],
    recommendedTime: when,
    impactType: "exposure-reduction",
    confidence: w.uncertain ? "low" : ctx.baseConfidence,
    limitations: w.uncertaintyNotes,
    caution: w.cautions.join(" ") || undefined,
    priority: w.verdict === "avoid" ? 1 : 2,
  });
}

function ventilationItem(ctx: Ctx, period: PeriodId, hours: HourlyPoint[], stats: PeriodStats | null, metric: Metric | null): Recommendation {
  const low = lowestHour(hours, metric);
  const label = PERIODS[period].label;
  const level = stats?.level ?? null;
  const at = low ? ctx.fmt(low.time) : null;
  if (level === null) {
    return rec(ctx, period, { key: "ventilation", category: "ventilation", title: "Ventilate as usual", description: "No forecast is available for this period, so ventilate as you normally would.", reason: "Forecast values are missing.", evidence: [], recommendedTime: null, impactType: "indoor-air", confidence: "low", limitations: [NO_INDOOR_SENSOR_NOTE] });
  }
  if (level <= 1) {
    return rec(ctx, period, {
      key: "ventilation",
      category: "ventilation",
      title: at ? `Air out the home around ${at}` : "Air out the home",
      description: "Outdoor air is comparatively reasonable, so this is a sensible time to bring in fresh air.",
      reason: `${label} air is forecast in the ${stats?.levelLabel.toLowerCase()} concern range${at ? ` and lowest around ${at}` : ""}.`,
      evidence: evidenceFor(stats, label),
      recommendedTime: at,
      impactType: "indoor-air",
      limitations: [NO_INDOOR_SENSOR_NOTE, MODEL_LIMITATION],
      priority: 4,
    });
  }
  return rec(ctx, period, {
    key: "ventilation",
    category: "ventilation",
    title: at ? `Keep airing brief; if needed, around ${at}` : "Keep windows mostly closed",
    description: "Open windows only briefly and when needed, such as while cooking or to clear humidity.",
    reason: `${label} air is forecast to be ${stats?.levelLabel.toLowerCase()} concern.`,
    evidence: evidenceFor(stats, label),
    recommendedTime: at,
    impactType: "indoor-air",
    limitations: [NO_INDOOR_SENSOR_NOTE, MODEL_LIMITATION],
    caution: "Always ventilate when a gas or other fuel-burning appliance is in use.",
    priority: 2,
  });
}

function commuteItem(ctx: Ctx, period: PeriodId, clock: string, direction: "out" | "back"): Recommendation | null {
  const { prefs, snapshot, nowMs } = ctx;
  if (prefs.commuteMode === "none" || prefs.routine === "home") return null;
  const commuteHour = Math.floor(clockToMinutes(clock) / 60);
  // The next forecast hour that contains the commute time.
  const match = snapshot.hourly.find((h) => h.epochMs >= nowMs - 3_600_000 && localHour(h.time) === commuteHour);
  const c = match ? assessConcern(match) : null;
  const factor = EMISSION_FACTORS[prefs.commuteMode];
  const open = prefs.commuteMode === "two_wheeler" || prefs.commuteMode === "walk" || prefs.commuteMode === "cycle";
  const evidence = c && match ? [`Forecast at ${ctx.fmt(match.time)}: ${c.basis} ${Math.round(c.value)} (${c.standardLabel})`] : ["No forecast value for your commute time"];
  let description: string;
  let caution: string | undefined;
  if (c && c.level >= 3 && open) {
    description = `Air around your ${direction === "out" ? "departure" : "return"} time is forecast to be ${c.label.toLowerCase()}. If practical, take an enclosed bus or metro, or shift the trip toward a cleaner hour.`;
    caution = "If you choose to wear a mask, a well-fitted N95/FFP2 respirator filters particles far better than cloth; it does not remove gases.";
  } else if (prefs.commuteMode === "car" || prefs.commuteMode === "two_wheeler") {
    description = `Where practical, a metro or bus trip has lower estimated emissions (${factor.label}: ~${factor.gramsPerPassengerKm} g CO₂e/pkm vs metro ~${EMISSION_FACTORS.metro.gramsPerPassengerKm}).${prefs.commuteMode === "car" ? " In the car, keep windows closed and use recirculation in heavy traffic." : ""}`;
  } else {
    description = `Your ${factor.label.toLowerCase()} commute already has low estimated emissions.${c && c.level >= 2 ? " Keep an eye on the forecast for this hour." : ""}`;
  }
  return rec(ctx, period, {
    key: `commute-${direction}`,
    category: "commute",
    title: direction === "out" ? `Commute out at ${clock}` : `Commute home at ${clock}`,
    description,
    reason: c ? `Forecast air at that hour is ${c.label.toLowerCase()} concern.` : "Commute advice uses your saved travel mode.",
    evidence,
    recommendedTime: clock,
    impactType: c && c.level >= 3 && open ? "exposure-reduction" : "emissions-reduction",
    limitations: [MODEL_LIMITATION, "No route-level pollution data is used.", "CO₂e savings do not translate into a measurable local AQI change."],
    caution,
    source: c ? ctx.source : EMISSION_SOURCE.title,
    priority: c && c.level >= 3 ? 2 : 4,
  });
}

/**
 * Builds a four-part day plan (morning, afternoon, evening, night) for the next occurrence
 * of each period, using forecast data and the user's saved preferences.
 */
export function buildDailyPlan(
  snapshot: AirQualitySnapshot,
  prefs: Preferences,
  nowMs: number,
  formatTime: (t: string) => string = (t) => t.slice(11),
): DailyPlan {
  const grouped = collectPeriods(snapshot, nowMs);
  const all = Object.values(grouped).flat();
  const metric = chooseMetric(all);
  const ctx: Ctx = {
    snapshot,
    prefs,
    nowMs,
    fmt: formatTime,
    source: snapshot.origin === "demo" ? "Sample demo data (not real readings)" : `${snapshot.model.name}, via Open-Meteo`,
    baseConfidence: snapshot.origin === "demo" || snapshot.origin === "cache" || isStale(snapshot, nowMs) ? "low" : snapshot.model.id === "cams_europe" ? "high" : "medium",
  };
  const nowLocal = epochToLocalTime(nowMs, snapshot.utcOffsetSeconds);
  const sensitive = hasSensitiveMember(prefs.household);
  const dominant = dominantPollutant(snapshot);

  const periods: PlanPeriod[] = ORDER.map((id) => {
    const hours = grouped[id];
    const stats = statsFor(hours, metric);
    const label = PERIODS[id].label;
    const items: (Recommendation | null)[] = [];

    if (id === "morning") {
      items.push(activityItem(ctx, id, hours));
      items.push(ventilationItem(ctx, id, hours, stats, metric));
      items.push(commuteItem(ctx, id, prefs.leaveTime, "out"));
    } else if (id === "afternoon") {
      const ozoneLed = dominant?.key === "ozone";
      items.push(
        rec(ctx, id, {
          key: "exposure",
          category: "outdoor",
          title: stats && stats.level >= 2 ? "Limit long or strenuous time outdoors" : "Afternoon errands are reasonable",
          description:
            stats && stats.level >= 2
              ? `Plan errands to be short and avoid hard exertion outdoors.${ozoneLed ? " Ozone, today's main pollutant, usually peaks in the afternoon." : ""}`
              : "Outdoor air is forecast to be comparatively reasonable this afternoon.",
          reason: stats ? `Afternoon forecast is ${stats.levelLabel.toLowerCase()} concern.` : "No afternoon forecast available.",
          evidence: evidenceFor(stats, label),
          recommendedTime: "12:00–17:00",
          impactType: "exposure-reduction",
          caution: sensitive && stats && stats.level >= 2 ? "Sensitive household members should keep outdoor time especially short." : undefined,
          priority: stats && stats.level >= 3 ? 1 : 3,
        }),
      );
      items.push(
        rec(ctx, id, {
          key: "indoor",
          category: "indoor",
          title: stats && stats.level >= 2 ? (prefs.equipment.airPurifier ? "Run the purifier in the occupied room" : "Keep your cleaner room closed") : "Keep indoor sources low",
          description:
            stats && stats.level >= 2
              ? "Keep doors and windows of the room you use most closed during these hours."
              : "Avoid incense, smoking and strong cleaning sprays indoors.",
          reason: stats ? `Outdoor air this afternoon: ${stats.levelLabel.toLowerCase()} concern.` : "General indoor-air practice.",
          evidence: evidenceFor(stats, label),
          recommendedTime: "Afternoon",
          impactType: "indoor-air",
          limitations: [NO_INDOOR_SENSOR_NOTE],
          priority: 3,
        }),
      );
      const car = prefs.commuteMode === "car" || prefs.commuteMode === "two_wheeler";
      items.push(
        rec(ctx, id, {
          key: "low-emission",
          category: "commute",
          title: car ? "Combine errands into one trip, or walk short ones" : "Keep short errands on foot or by cycle",
          description: car
            ? "Fewer and shorter vehicle trips cut emissions. For short distances, walking or cycling has zero direct emissions, ideally at a cleaner hour."
            : "Walking and cycling short distances have zero direct emissions. On high-pollution hours, keep them brief.",
          reason: "Avoiding unnecessary vehicle trips reduces emissions and traffic pollution collectively.",
          evidence: [`${EMISSION_FACTORS[prefs.commuteMode === "none" ? "car" : prefs.commuteMode].label}: ~${EMISSION_FACTORS[prefs.commuteMode === "none" ? "car" : prefs.commuteMode].gramsPerPassengerKm} g CO₂e/pkm`],
          recommendedTime: "When running errands",
          impactType: "emissions-reduction",
          source: EMISSION_SOURCE.title,
          confidence: "medium",
          limitations: ["Illustrative case-study factors.", "Emission cuts do not produce a measurable change in your local AQI on their own."],
          priority: 5,
        }),
      );
    } else if (id === "evening") {
      items.push(activityItem(ctx, id, hours));
      items.push(commuteItem(ctx, id, prefs.returnTime, "back"));
      items.push(
        rec(ctx, id, {
          key: "cooking",
          category: "cooking",
          title: prefs.equipment.kitchenExhaust ? "Run the kitchen exhaust while cooking dinner" : "Ventilate the kitchen while cooking dinner",
          description:
            stats && stats.level >= 2
              ? "Extract at the source and keep the kitchen door closed, rather than opening every window in the home."
              : "Open the kitchen window or use the exhaust while cooking and for a while after.",
          reason: "Cooking, especially frying, is one of the largest indoor sources of fine particles.",
          evidence: evidenceFor(stats, label),
          recommendedTime: "While cooking",
          impactType: "indoor-air",
          limitations: [NO_INDOOR_SENSOR_NOTE],
          confidence: "medium",
          priority: 3,
        }),
      );
      items.push(
        rec(ctx, id, {
          key: "sources",
          category: "indoor",
          title: "Skip incense, mosquito coils and candles tonight",
          description: "These release smoke and fine particles indoors. Use alternatives such as mosquito nets or plug-in repellents.",
          reason: stats && stats.level >= 2 ? "Outdoor air is already elevated, so indoor smoke adds to the load." : "Reduces avoidable indoor smoke.",
          evidence: evidenceFor(stats, label),
          recommendedTime: "Evening",
          impactType: "indoor-air",
          limitations: [NO_INDOOR_SENSOR_NOTE],
          confidence: "medium",
          priority: 4,
        }),
      );
    } else {
      items.push(
        rec(ctx, id, {
          key: "bedroom",
          category: "indoor",
          title: stats && stats.level >= 2 ? "Keep the bedroom closed overnight" : "Some airing before bed is reasonable",
          description:
            stats && stats.level >= 2
              ? prefs.equipment.airPurifier
                ? "Run the purifier in the bedroom with the door and windows closed."
                : "Close bedroom windows before the most polluted hours. A HEPA purifier sized for the bedroom helps most."
              : "Air the bedroom briefly before sleep, then close up if the forecast rises overnight.",
          reason: stats ? `Night forecast is ${stats.levelLabel.toLowerCase()} concern.` : "No night forecast available.",
          evidence: evidenceFor(stats, label),
          recommendedTime: "Before bed",
          impactType: "indoor-air",
          limitations: [NO_INDOOR_SENSOR_NOTE, MODEL_LIMITATION],
          caution: sensitive ? "Prioritise the sleeping room of sensitive family members." : undefined,
          priority: stats && stats.level >= 2 ? 2 : 4,
        }),
      );
      items.push(ventilationItem(ctx, id, hours, stats, metric));
      items.push(
        rec(ctx, id, {
          key: "prepare",
          category: "data",
          title: "Check tomorrow's plan in the morning",
          description: "Forecasts update every 12–24 hours. Re-open My Clean-Air Day before heading out.",
          reason: "Timing advice is only as current as the latest forecast run.",
          evidence: [`Data time: ${ctx.fmt(snapshot.current.time)} ${relativeDayLabel(snapshot.current.time, nowLocal).toLowerCase()}`],
          recommendedTime: "Tomorrow morning",
          impactType: "awareness",
          confidence: "high",
          limitations: [],
          priority: 6,
        }),
      );
    }

    const present = items.filter((r): r is Recommendation => r !== null).sort((a, b) => a.priority - b.priority);
    const first = hours[0];
    const last = hours[hours.length - 1];
    return {
      id,
      label,
      dayLabel: first ? relativeDayLabel(first.time, nowLocal) : "",
      startTime: first?.time ?? "",
      endTime: last ? epochToLocalTime(last.epochMs + 3_600_000, snapshot.utcOffsetSeconds) : "",
      stats,
      items: present,
    };
  });

  // Chronological order: at 22:30, tonight comes before tomorrow morning. Periods without data go last.
  periods.sort((a, b) => (a.startTime || "9999").localeCompare(b.startTime || "9999"));

  const withStats = periods.filter((p) => p.stats);
  const cleanest = withStats.length ? withStats.reduce((a, b) => ((b.stats as PeriodStats).mean < (a.stats as PeriodStats).mean ? b : a)) : null;
  const worst = withStats.length ? withStats.reduce((a, b) => ((b.stats as PeriodStats).mean > (a.stats as PeriodStats).mean ? b : a)) : null;

  let headline = "Not enough forecast data to plan the day. General indoor-air advice is shown.";
  if (cleanest?.stats && worst?.stats) {
    headline =
      cleanest.stats.level >= 3
        ? `Air is forecast to be poor all day. ${cleanest.label} is comparatively the least polluted period.`
        : `${cleanest.label} is forecast to be the cleanest period (${cleanest.stats.levelLabel.toLowerCase()} concern); ${worst.label.toLowerCase()} the most polluted (${worst.stats.levelLabel.toLowerCase()}).`;
  }

  const notes = [MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE];
  if (snapshot.model.id === "cams_global") notes.push("The global model runs in 3-hour steps on a ~45 km grid; hour-level differences are approximate.");
  if (snapshot.origin === "demo") notes.unshift("This plan uses SAMPLE data for demonstration. It does not describe real conditions.");

  return {
    generatedAtMs: nowMs,
    dataTime: snapshot.current.time,
    headline,
    cleanestPeriod: cleanest?.id ?? null,
    periods,
    notes,
  };
}
