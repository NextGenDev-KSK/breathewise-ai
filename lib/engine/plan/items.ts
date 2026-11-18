import type { Recommendation } from "@/types/recommendation";
import { assessConcern } from "@/lib/air/indices";
import { MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE } from "@/lib/content/notices";
import { describeMetricValue } from "@/lib/engine/analysis";
import { EMISSION_FACTORS, EMISSION_SOURCE, isOpenAirMode } from "@/lib/engine/emissions";
import { findOutdoorWindow } from "@/lib/engine/windows";
import { evidenceFor, makeItem, type PeriodInput, type PlanContext } from "@/lib/engine/plan/context";
import { lowestHour, PERIODS } from "@/lib/engine/plan/periods";
import { clockToMinutes, HOUR_MS, localHour } from "@/lib/time";

/** Best time in this period for the user's outdoor activity, if they want one here. */
export function activityItem(ctx: PlanContext, period: PeriodInput): Recommendation | null {
  const { prefs } = ctx;
  const activity = prefs.outdoorActivity;
  if (activity === "none" || activity === "commuting") return null;
  if (prefs.preferredActivityTime !== "flexible" && prefs.preferredActivityTime !== period.id) return null;

  const range = PERIODS[period.id];
  const window = findOutdoorWindow(ctx.snapshot, {
    activity,
    household: prefs.household,
    nowMs: Math.max(ctx.nowMs, period.hours[0]?.epochMs ?? ctx.nowMs),
    horizonHours: 12,
    hourRange: { start: range.start, end: Math.min(range.end, 24) },
    formatTime: ctx.fmt,
  });
  if (window.status !== "ok" || !window.best || !window.metric) return null;

  const { best, profile, verdict } = window;
  const when = `${ctx.fmt(best.startTime)}–${ctx.fmt(best.endTime)}`;
  const descriptions = {
    avoid: `All ${period.id} hours are in a concerning range. If you do go out, ${when} is comparatively lower.`,
    reduce: `Comparatively the cleanest ${period.id} slot, but keep it shorter and lighter than usual.`,
    reasonable: `Comparatively the cleanest ${period.id} slot for this activity.`,
    unknown: "",
  } as const;
  return makeItem(ctx, period.id, {
    key: "activity",
    category: "outdoor",
    title:
      verdict === "avoid"
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
    priority: verdict === "avoid" ? 1 : 2,
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

/** Advice for the commute that leaves (or returns) at the user's saved time. */
export function commuteItem(
  ctx: PlanContext,
  period: PeriodInput,
  clock: string,
  direction: "out" | "back",
): Recommendation | null {
  const { prefs, snapshot, nowMs } = ctx;
  const mode = prefs.commuteMode;
  if (mode === "none" || prefs.routine === "home") return null;

  const commuteHour = Math.floor(clockToMinutes(clock) / 60);
  const match = snapshot.hourly.find(
    (h) => h.epochMs >= nowMs - HOUR_MS && localHour(h.time) === commuteHour,
  );
  const concern = match ? assessConcern(match) : null;
  const factor = EMISSION_FACTORS[mode];
  const highExposure = concern !== null && concern.level >= 3 && isOpenAirMode(mode);

  let description: string;
  if (highExposure) {
    description = `Air around your ${direction === "out" ? "departure" : "return"} time is forecast to be ${concern.label.toLowerCase()}. If practical, take an enclosed bus or metro, or shift the trip toward a cleaner hour.`;
  } else if (mode === "car" || mode === "two_wheeler") {
    const carTip =
      mode === "car" ? " In the car, keep windows closed and use recirculation in heavy traffic." : "";
    description = `Where practical, a metro or bus trip has lower estimated emissions (${factor.label}: ~${factor.gramsPerPassengerKm} g CO₂e/pkm vs metro ~${EMISSION_FACTORS.metro.gramsPerPassengerKm}).${carTip}`;
  } else {
    const watch = concern && concern.level >= 2 ? " Keep an eye on the forecast for this hour." : "";
    description = `Your ${factor.label.toLowerCase()} commute already has low estimated emissions.${watch}`;
  }

  return makeItem(ctx, period.id, {
    key: `commute-${direction}`,
    category: "commute",
    title: direction === "out" ? `Commute out at ${clock}` : `Commute home at ${clock}`,
    description,
    reason: concern
      ? `Forecast air at that hour is ${concern.label.toLowerCase()} concern.`
      : "Commute advice uses your saved travel mode.",
    evidence:
      concern && match
        ? [
            `Forecast at ${ctx.fmt(match.time)}: ${concern.basis} ${Math.round(concern.value)} (${concern.standardLabel})`,
          ]
        : ["No forecast value for your commute time"],
    recommendedTime: clock,
    impactType: highExposure ? "exposure-reduction" : "emissions-reduction",
    limitations: [
      MODEL_LIMITATION,
      "No route-level pollution data is used.",
      "CO₂e savings do not translate into a measurable local AQI change.",
    ],
    caution: highExposure
      ? "If you choose to wear a mask, a well-fitted N95/FFP2 respirator filters particles far better than cloth; it does not remove gases."
      : undefined,
    source: concern ? ctx.source : EMISSION_SOURCE.title,
    priority: concern && concern.level >= 3 ? 2 : 4,
  });
}
