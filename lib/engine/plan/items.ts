import type { HourlyPoint } from "@/types/air";
import type { Activity, CommuteMode } from "@/types/preferences";
import type { Recommendation } from "@/types/recommendation";
import { assessConcern, type ConcernAssessment } from "@/lib/air/indices";
import type { Verdict } from "@/lib/engine/activities";
import { MASK_NOTE, MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE } from "@/lib/content/notices";
import { describeMetricValue } from "@/lib/engine/analysis";
import { EMISSION_FACTORS, EMISSION_SOURCE, isOpenAirMode } from "@/lib/engine/emissions";
import { findOutdoorWindow, type OutdoorWindowResult } from "@/lib/engine/windows";
import { evidenceFor, makeItem, type PeriodInput, type PlanContext } from "@/lib/engine/plan/context";
import { lowestHour, PERIODS } from "@/lib/engine/plan/periods";
import { clockToMinutes, HOUR_MS, localHour } from "@/lib/time";

/** The activity to plan in this period, or null when the user has none or prefers another period. */
function plannedActivity(ctx: PlanContext, period: PeriodInput): Activity | null {
  const { outdoorActivity, preferredActivityTime } = ctx.prefs;
  if (outdoorActivity === "none" || outdoorActivity === "commuting") return null;
  const wanted = preferredActivityTime === "flexible" || preferredActivityTime === period.id;
  return wanted ? outdoorActivity : null;
}

function periodWindow(ctx: PlanContext, period: PeriodInput, activity: Activity): OutdoorWindowResult {
  const range = PERIODS[period.id];
  return findOutdoorWindow(ctx.snapshot, {
    activity,
    household: ctx.prefs.household,
    nowMs: Math.max(ctx.nowMs, period.hours[0]?.epochMs ?? ctx.nowMs),
    horizonHours: 12,
    hourRange: { start: range.start, end: Math.min(range.end, 24) },
    formatTime: ctx.fmt,
  });
}

/** Best time in this period for the user's outdoor activity, if they want one here. */
export function activityItem(ctx: PlanContext, period: PeriodInput): Recommendation | null {
  const activity = plannedActivity(ctx, period);
  if (!activity) return null;
  const window = periodWindow(ctx, period, activity);
  if (window.status !== "ok" || !window.best || !window.metric) return null;

  const { best, profile, verdict } = window;
  const when = `${ctx.fmt(best.startTime)}–${ctx.fmt(best.endTime)}`;
  const descriptions: Record<Verdict, string> = {
    avoid: `All ${period.id} hours are in a concerning range. If you do go out, ${when} is comparatively lower.`,
    reduce: `Comparatively the cleanest ${period.id} slot, but keep it shorter and lighter than usual.`,
    reasonable: `Comparatively the cleanest ${period.id} slot for this activity.`,
    unknown: "",
  };
  const avoid = verdict === "avoid";
  return makeItem(ctx, period.id, {
    key: "activity",
    category: "outdoor",
    title: avoid
      ? `Swap ${profile.label.toLowerCase()} for an indoor alternative`
      : `${profile.label} at ${when}`,
    description: descriptions[verdict],
    reason: window.reasons[0] ?? "",
    evidence: [
      `${describeMetricValue(window.metric, best.meanValue)} forecast at ${ctx.fmt(best.startTime)}`,
    ],
    recommendedTime: when,
    impactType: "exposure-reduction",
    confidence: window.uncertain ? "low" : ctx.confidence,
    limitations: window.uncertaintyNotes,
    caution: window.cautions.join(" ") || undefined,
    priority: avoid ? 1 : 2,
  });
}

/** Whether, and when, to air out the home during this period. */
export function ventilationItem(ctx: PlanContext, period: PeriodInput): Recommendation {
  const { stats, label } = period;
  const low = lowestHour(period.hours, period.metric);
  const at = low ? ctx.fmt(low.time) : null;
  const base = {
    key: "ventilation",
    category: "ventilation",
    impactType: "indoor-air",
    recommendedTime: at,
  } as const;

  if (!stats) {
    return makeItem(ctx, period.id, {
      ...base,
      title: "Ventilate as usual",
      description: "No forecast is available for this period, so ventilate as you normally would.",
      reason: "Forecast values are missing.",
      evidence: [],
      recommendedTime: null,
      confidence: "low",
      limitations: [NO_INDOOR_SENSOR_NOTE],
    });
  }
  const levelText = stats.levelLabel.toLowerCase();
  if (stats.level <= 1) {
    return makeItem(ctx, period.id, {
      ...base,
      title: at ? `Air out the home around ${at}` : "Air out the home",
      description:
        "Outdoor air is comparatively reasonable, so this is a sensible time to bring in fresh air.",
      reason: `${label} air is forecast in the ${levelText} concern range${at ? ` and lowest around ${at}` : ""}.`,
      evidence: evidenceFor(stats, label),
      limitations: [NO_INDOOR_SENSOR_NOTE, MODEL_LIMITATION],
      priority: 4,
    });
  }
  return makeItem(ctx, period.id, {
    ...base,
    title: at ? `Keep airing brief; if needed, around ${at}` : "Keep windows mostly closed",
    description: "Open windows only briefly and when needed, such as while cooking or to clear humidity.",
    reason: `${label} air is forecast to be ${levelText} concern.`,
    evidence: evidenceFor(stats, label),
    limitations: [NO_INDOOR_SENSOR_NOTE, MODEL_LIMITATION],
    caution: "Always ventilate when a gas or other fuel-burning appliance is in use.",
    priority: 2,
  });
}

/** A forecast hour and the concern it implies. */
type Forecast = { hour: HourlyPoint; concern: ConcernAssessment };

/** The forecast hour containing a "HH:MM" commute time, and its concern, if any. */
function forecastAtClock(
  ctx: PlanContext,
  clock: string,
): { hour: HourlyPoint; concern: ConcernAssessment } | null {
  const commuteHour = Math.floor(clockToMinutes(clock) / 60);
  const hour = ctx.snapshot.hourly.find(
    (h) => h.epochMs >= ctx.nowMs - HOUR_MS && localHour(h.time) === commuteHour,
  );
  const concern = hour ? assessConcern(hour) : null;
  return hour && concern ? { hour, concern } : null;
}

const CAR_AIR_TIP = " In the car, keep windows closed and use recirculation in heavy traffic.";

/** What to say about this commute: exposure advice on bad hours for open-air modes, else emissions. */
function commuteDescription(mode: CommuteMode, concern: ConcernAssessment | null, direction: "out" | "back") {
  const factor = EMISSION_FACTORS[mode];
  if (concern && concern.level >= 3 && isOpenAirMode(mode)) {
    const when = direction === "out" ? "departure" : "return";
    return `Air around your ${when} time is forecast to be ${concern.label.toLowerCase()}. If practical, take an enclosed bus or metro, or shift the trip toward a cleaner hour.`;
  }
  const carTip = mode === "car" || mode === "carpool" ? CAR_AIR_TIP : "";
  if (mode === "car" || mode === "two_wheeler") {
    const share =
      mode === "car"
        ? ` Sharing the car with two others cuts each person's share to ~${EMISSION_FACTORS.carpool.gramsPerPassengerKm} g.`
        : "";
    return `Where practical, a metro or bus trip has lower estimated emissions (${factor.label}: ~${factor.gramsPerPassengerKm} g CO₂e/pkm vs metro ~${EMISSION_FACTORS.metro.gramsPerPassengerKm}).${share}${carTip}`;
  }
  const watch = concern && concern.level >= 2 ? " Keep an eye on the forecast for this hour." : "";
  return `Your ${factor.label.toLowerCase()} commute already has comparatively low estimated emissions.${watch}${carTip}`;
}

/** Reason, evidence, source and priority, which all depend on whether the commute hour has a forecast. */
function commuteBasis(ctx: PlanContext, forecast: Forecast | null) {
  if (!forecast) {
    return {
      reason: "Commute advice uses your saved travel mode.",
      evidence: ["No forecast value for your commute time"],
      source: EMISSION_SOURCE.title,
      priority: 4,
    };
  }
  const { hour, concern } = forecast;
  return {
    reason: `Forecast air at that hour is ${concern.label.toLowerCase()} concern.`,
    evidence: [
      `Forecast at ${ctx.fmt(hour.time)}: ${concern.basis} ${Math.round(concern.value)} (${concern.standardLabel})`,
    ],
    source: ctx.source,
    priority: concern.level >= 3 ? 2 : 4,
  };
}

function commuteTitle(student: boolean, direction: "out" | "back", clock: string): string {
  if (student)
    return direction === "out" ? `Leave for school or college at ${clock}` : `Head home at ${clock}`;
  return direction === "out" ? `Commute out at ${clock}` : `Commute home at ${clock}`;
}

/** Advice for the commute that leaves (or returns) at the user's saved time. */
export function commuteItem(
  ctx: PlanContext,
  period: PeriodInput,
  clock: string,
  direction: "out" | "back",
): Recommendation | null {
  const mode = ctx.prefs.commuteMode;
  if (mode === "none" || ctx.prefs.routine === "home") return null;

  const forecast = forecastAtClock(ctx, clock);
  const concern = forecast?.concern ?? null;
  const highExposure = concern !== null && concern.level >= 3 && isOpenAirMode(mode);
  return makeItem(ctx, period.id, {
    key: `commute-${direction}`,
    category: "commute",
    title: commuteTitle(ctx.prefs.routine === "student", direction, clock),
    description: commuteDescription(mode, concern, direction),
    ...commuteBasis(ctx, forecast),
    recommendedTime: clock,
    impactType: highExposure ? "exposure-reduction" : "emissions-reduction",
    limitations: [
      MODEL_LIMITATION,
      "No route-level pollution data is used.",
      "CO₂e savings do not translate into a measurable local AQI change.",
    ],
    caution: highExposure ? MASK_NOTE : undefined,
  });
}
