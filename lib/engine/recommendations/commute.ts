import { MASK_NOTE, MODEL_LIMITATION } from "@/lib/content/notices";
import { EMISSION_FACTORS, EMISSION_SOURCE, isOpenAirMode, savingPerKm } from "@/lib/engine/emissions";
import type { Recommendation } from "@/types/recommendation";
import type { Rule, RuleContext } from "@/lib/engine/recommendations/types";

/**
 * Two-wheeler riders, walkers and cyclists breathe roadside air directly, so on high-pollution days they
 * get exposure advice (timing, enclosed transport, a well-fitted respirator) before emissions advice.
 */
function exposureAdvice({ preferences, concern, source }: RuleContext): Recommendation | null {
  const mode = preferences.commuteMode;
  if (mode === "none" || !isOpenAirMode(mode) || !concern || concern.level < 3) return null;
  const rider = mode === "two_wheeler";
  return {
    id: "commute-exposure",
    category: "commute",
    title: rider
      ? "Ride at a cleaner hour or take enclosed transport today"
      : "Time your walk or ride, or use enclosed transport today",
    description: rider
      ? "On a two-wheeler you breathe traffic exhaust at face height. On high-pollution days, shift the trip to a cleaner hour or take an enclosed bus or metro where practical."
      : "Walking and cycling keep emissions at zero, but you breathe roadside air directly. On high-pollution days, shift the trip to a cleaner hour or take an enclosed bus or metro where practical.",
    reason: `Outdoor air is ${concern.label.toLowerCase()} (${concern.basis} ${Math.round(concern.value)}).`,
    evidence: [`${concern.basis}: ${Math.round(concern.value)}`],
    recommendedTime: "Today",
    impactType: "exposure-reduction",
    confidence: "medium",
    source,
    caution: MASK_NOTE,
    limitations: [
      MODEL_LIMITATION,
      "No route-level pollution data is available, so no route is claimed to be cleaner.",
    ],
    priority: 3,
  };
}

/** Lower-emission alternatives for people who drive or ride: public transport and, for cars, sharing. */
function emissionsAdvice({ preferences }: RuleContext): Recommendation | null {
  const mode = preferences.commuteMode;
  if (mode !== "car" && mode !== "two_wheeler") return null;
  const factor = EMISSION_FACTORS[mode];
  const carpool = EMISSION_FACTORS.carpool;
  const sharing =
    mode === "car"
      ? ` Sharing the car with two others cuts each person's share from ~${factor.gramsPerPassengerKm} to ~${carpool.gramsPerPassengerKm} g CO₂e per km.`
      : "";
  return {
    id: "commute-lower-emission",
    category: "commute",
    title:
      mode === "car"
        ? "Try public transport or carpooling for some car trips"
        : `Try public transport for some ${factor.label.toLowerCase()} trips`,
    description: `Where metro or bus is practical, each passenger-km switched from ${factor.label.toLowerCase()} to metro avoids roughly ${savingPerKm(mode, "metro")} g CO₂e in the reference case study.${sharing} Smart Commute estimates your own trips, including combined errands.`,
    reason: "Lower-emission travel reduces greenhouse-gas emissions and, collectively, traffic pollution.",
    evidence: [
      `${factor.label}: ~${factor.gramsPerPassengerKm} g CO₂e/pkm`,
      ...(mode === "car" ? [`${carpool.label}: ~${carpool.gramsPerPassengerKm} g CO₂e/pkm`] : []),
      `Metro: ~${EMISSION_FACTORS.metro.gramsPerPassengerKm} g CO₂e/pkm`,
    ],
    recommendedTime: "Next commute",
    impactType: "emissions-reduction",
    confidence: "medium",
    source: EMISSION_SOURCE.title,
    limitations: [
      "Illustrative life-cycle factors for an Indian case study; actual emissions vary.",
      "A CO₂e reduction is not a measurable change in today's local AQI.",
    ],
    priority: 6,
  };
}

/** Commute advice: exposure first for open-air commuters on bad days, otherwise lower-emission options. */
export const commute: Rule = (ctx) => exposureAdvice(ctx) ?? emissionsAdvice(ctx);
