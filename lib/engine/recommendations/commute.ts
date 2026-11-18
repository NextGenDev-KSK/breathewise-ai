import { MODEL_LIMITATION } from "@/lib/content/notices";
import { EMISSION_FACTORS, EMISSION_SOURCE, savingPerKm } from "@/lib/engine/emissions";
import type { Rule } from "@/lib/engine/recommendations/types";

/** Lower-emission alternatives for drivers; exposure timing for walkers and cyclists on bad days. */
export const commute: Rule = ({ preferences, concern, source }) => {
  const mode = preferences.commuteMode;
  if (mode === "car" || mode === "two_wheeler") {
    const factor = EMISSION_FACTORS[mode];
    return {
      id: "commute-lower-emission",
      category: "commute",
      title: `Try public transport for some ${factor.label.toLowerCase()} trips`,
      description: `Where metro or bus is practical, each passenger-km switched from ${factor.label.toLowerCase()} to metro avoids roughly ${savingPerKm(mode, "metro")} g CO₂e in the reference case study. Use the Smart Commute tool to estimate your own trips.`,
      reason: "Lower-emission travel reduces greenhouse-gas emissions and, collectively, traffic pollution.",
      evidence: [
        `${factor.label}: ~${factor.gramsPerPassengerKm} g CO₂e/pkm`,
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
  if ((mode === "walk" || mode === "cycle") && concern && concern.level >= 3) {
    return {
      id: "commute-exposure",
      category: "commute",
      title: "Time your walk or ride, or use enclosed transport today",
      description:
        "Walking and cycling keep emissions at zero, but you breathe roadside air directly. On high-pollution days, shift the trip to a cleaner hour or take an enclosed bus or metro where practical.",
      reason: `Outdoor air is ${concern.label.toLowerCase()} (${concern.basis} ${Math.round(concern.value)}).`,
      evidence: [`${concern.basis}: ${Math.round(concern.value)}`],
      recommendedTime: "Today",
      impactType: "exposure-reduction",
      confidence: "medium",
      source,
      limitations: [
        MODEL_LIMITATION,
        "No route-level pollution data is available, so no route is claimed to be cleaner.",
      ],
      priority: 3,
    };
  }
  return null;
};
