import type { Recommendation } from "@/types/recommendation";
import { MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE } from "@/lib/content/notices";
import { EMISSION_FACTORS, EMISSION_SOURCE } from "@/lib/engine/emissions";
import { evidenceFor, makeItem, type PeriodInput, type PlanContext } from "@/lib/engine/plan/context";
import { activityItem, commuteItem, ventilationItem } from "@/lib/engine/plan/items";
import { isElevated, type PeriodId } from "@/lib/engine/plan/periods";
import { relativeDayLabel } from "@/lib/time";

type PeriodBuilder = (ctx: PlanContext, period: PeriodInput) => (Recommendation | null)[];

const morning: PeriodBuilder = (ctx, period) => [
  activityItem(ctx, period),
  ventilationItem(ctx, period),
  commuteItem(ctx, period, ctx.prefs.leaveTime, "out"),
];

type ItemBuilder = (ctx: PlanContext, period: PeriodInput) => Recommendation;

const afternoonExposure: ItemBuilder = (ctx, { id, stats, label }) => {
  const elevated = isElevated(stats);
  const ozoneNote =
    ctx.dominant?.key === "ozone" ? " Ozone, today's main pollutant, usually peaks in the afternoon." : "";
  return makeItem(ctx, id, {
    key: "exposure",
    category: "outdoor",
    title: elevated ? "Limit long or strenuous time outdoors" : "Afternoon errands are reasonable",
    description: elevated
      ? `Plan errands to be short and avoid hard exertion outdoors.${ozoneNote}`
      : "Outdoor air is forecast to be comparatively reasonable this afternoon.",
    reason: stats
      ? `Afternoon forecast is ${stats.levelLabel.toLowerCase()} concern.`
      : "No afternoon forecast available.",
    evidence: evidenceFor(stats, label),
    recommendedTime: "12:00–17:00",
    impactType: "exposure-reduction",
    caution:
      ctx.sensitive && elevated
        ? "Sensitive household members should keep outdoor time especially short."
        : undefined,
    priority: stats && stats.level >= 3 ? 1 : 3,
  });
};

const afternoonIndoor: ItemBuilder = (ctx, { id, stats, label }) => {
  const elevated = isElevated(stats);
  let title = "Keep indoor sources low";
  if (elevated)
    title = ctx.prefs.equipment.airPurifier
      ? "Run the purifier in the occupied room"
      : "Keep your cleaner room closed";
  return makeItem(ctx, id, {
    key: "indoor",
    category: "indoor",
    title,
    description: elevated
      ? "Keep doors and windows of the room you use most closed during these hours."
      : "Avoid incense, smoking and strong cleaning sprays indoors.",
    reason: stats
      ? `Outdoor air this afternoon: ${stats.levelLabel.toLowerCase()} concern.`
      : "General indoor-air practice.",
    evidence: evidenceFor(stats, label),
    recommendedTime: "Afternoon",
    impactType: "indoor-air",
    limitations: [NO_INDOOR_SENSOR_NOTE],
  });
};

const afternoonLowEmission: ItemBuilder = (ctx, { id }) => {
  const mode = ctx.prefs.commuteMode === "none" ? "car" : ctx.prefs.commuteMode;
  const drives = mode === "car" || mode === "two_wheeler";
  const factor = EMISSION_FACTORS[mode];
  return makeItem(ctx, id, {
    key: "low-emission",
    category: "commute",
    title: drives
      ? "Combine errands into one trip, or walk short ones"
      : "Keep short errands on foot or by cycle",
    description: drives
      ? "Fewer and shorter vehicle trips cut emissions. For short distances, walking or cycling has zero direct emissions, ideally at a cleaner hour."
      : "Walking and cycling short distances have zero direct emissions. On high-pollution hours, keep them brief.",
    reason: "Avoiding unnecessary vehicle trips reduces emissions and traffic pollution collectively.",
    evidence: [`${factor.label}: ~${factor.gramsPerPassengerKm} g CO₂e/pkm`],
    recommendedTime: "When running errands",
    impactType: "emissions-reduction",
    source: EMISSION_SOURCE.title,
    confidence: "medium",
    limitations: [
      "Illustrative case-study factors.",
      "Emission cuts do not produce a measurable change in your local AQI on their own.",
    ],
    priority: 5,
  });
};

const afternoon: PeriodBuilder = (ctx, period) => [
  afternoonExposure(ctx, period),
  afternoonIndoor(ctx, period),
  afternoonLowEmission(ctx, period),
];

const evening: PeriodBuilder = (ctx, period) => {
  const { stats, label } = period;
  const elevated = isElevated(stats);
  return [
    activityItem(ctx, period),
    commuteItem(ctx, period, ctx.prefs.returnTime, "back"),
    makeItem(ctx, period.id, {
      key: "cooking",
      category: "cooking",
      title: ctx.prefs.equipment.kitchenExhaust
        ? "Run the kitchen exhaust while cooking dinner"
        : "Ventilate the kitchen while cooking dinner",
      description: elevated
        ? "Extract at the source and keep the kitchen door closed, rather than opening every window in the home."
        : "Open the kitchen window or use the exhaust while cooking and for a while after.",
      reason: "Cooking, especially frying, is one of the largest indoor sources of fine particles.",
      evidence: evidenceFor(stats, label),
      recommendedTime: "While cooking",
      impactType: "indoor-air",
      limitations: [NO_INDOOR_SENSOR_NOTE],
      confidence: "medium",
    }),
    makeItem(ctx, period.id, {
      key: "sources",
      category: "indoor",
      title: "Skip incense, mosquito coils and candles tonight",
      description:
        "These release smoke and fine particles indoors. Use alternatives such as mosquito nets or plug-in repellents.",
      reason: elevated
        ? "Outdoor air is already elevated, so indoor smoke adds to the load."
        : "Reduces avoidable indoor smoke.",
      evidence: evidenceFor(stats, label),
      recommendedTime: "Evening",
      impactType: "indoor-air",
      limitations: [NO_INDOOR_SENSOR_NOTE],
      confidence: "medium",
      priority: 4,
    }),
  ];
};

const night: PeriodBuilder = (ctx, period) => {
  const { stats, label } = period;
  const elevated = isElevated(stats);
  const { snapshot } = ctx;
  let bedroomDescription =
    "Air the bedroom briefly before sleep, then close up if the forecast rises overnight.";
  if (elevated) {
    bedroomDescription = ctx.prefs.equipment.airPurifier
      ? "Run the purifier in the bedroom with the door and windows closed."
      : "Close bedroom windows before the most polluted hours. A HEPA purifier sized for the bedroom helps most.";
  }
  return [
    makeItem(ctx, period.id, {
      key: "bedroom",
      category: "indoor",
      title: elevated ? "Keep the bedroom closed overnight" : "Some airing before bed is reasonable",
      description: bedroomDescription,
      reason: stats
        ? `Night forecast is ${stats.levelLabel.toLowerCase()} concern.`
        : "No night forecast available.",
      evidence: evidenceFor(stats, label),
      recommendedTime: "Before bed",
      impactType: "indoor-air",
      limitations: [NO_INDOOR_SENSOR_NOTE, MODEL_LIMITATION],
      caution: ctx.sensitive ? "Prioritise the sleeping room of sensitive family members." : undefined,
      priority: elevated ? 2 : 4,
    }),
    ventilationItem(ctx, period),
    makeItem(ctx, period.id, {
      key: "prepare",
      category: "data",
      title: "Check tomorrow's plan in the morning",
      description: "Forecasts update every 12–24 hours. Re-open My Clean-Air Day before heading out.",
      reason: "Timing advice is only as current as the latest forecast run.",
      evidence: [
        `Data time: ${ctx.fmt(snapshot.current.time)} ${relativeDayLabel(snapshot.current.time, ctx.nowLocal).toLowerCase()}`,
      ],
      recommendedTime: "Tomorrow morning",
      impactType: "awareness",
      confidence: "high",
      limitations: [],
      priority: 6,
    }),
  ];
};

/** One builder per period: each returns that period's candidate items (null = not applicable). */
export const PERIOD_BUILDERS: Record<PeriodId, PeriodBuilder> = { morning, afternoon, evening, night };
