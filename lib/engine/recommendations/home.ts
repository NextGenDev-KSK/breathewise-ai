import { MODEL_LIMITATION, NO_INDOOR_SENSOR_NOTE } from "@/lib/content/notices";
import { getVentilationAdvice } from "@/lib/engine/indoor";
import type { Rule } from "@/lib/engine/recommendations/types";

/** Rules about the home: ventilation, filtration, cooking smoke and dust. */

/** When to air the home, based on the current hour versus the coming hours. */
export const ventilation: Rule = ({ snapshot, nowMs, fmt, source, confidence }) => {
  const advice = getVentilationAdvice(snapshot, nowMs, fmt);
  if (advice.status === "unknown") return null;
  const limit = advice.status === "limit";
  let recommendedTime = limit || advice.status === "brief" ? "Only when needed" : "Now";
  if (advice.nextBetterTime) recommendedTime = `Around ${fmt(advice.nextBetterTime)}`;
  return {
    id: "ventilation",
    category: "ventilation",
    title: advice.title,
    description: advice.description,
    reason: advice.reason,
    evidence: advice.evidence,
    recommendedTime,
    impactType: "indoor-air",
    confidence,
    source,
    limitations: [NO_INDOOR_SENSOR_NOTE],
    caution: limit
      ? "Always ventilate when using gas, kerosene or other fuel-burning appliances indoors."
      : undefined,
    priority: limit ? 2 : 5,
  };
};

/** From "Elevated" concern upward: run the purifier, or set up one cleaner room without one. */
export const purification: Rule = ({ preferences, concern, source }) => {
  if (!concern || concern.level < 2) return null;
  const hasPurifier = preferences.equipment.airPurifier;
  return {
    id: "purification",
    category: "indoor",
    title: hasPurifier ? "Run your air purifier in the room you use most" : "Set up one cleaner room",
    description: hasPurifier
      ? "Keep that room's doors and windows closed while the purifier runs, and use a higher setting during the worst hours."
      : "Pick one room (often the bedroom), keep it closed during polluted hours, and clean it with damp methods. A correctly sized HEPA purifier helps most.",
    reason: `Outdoor particle levels are ${concern.label.toLowerCase()}; filtration is the most direct way to lower indoor particles.`,
    evidence: [`${concern.basis}: ${Math.round(concern.value)} (${concern.standardLabel})`],
    recommendedTime: "During polluted hours",
    impactType: "indoor-air",
    confidence: "medium",
    source,
    limitations: [
      NO_INDOOR_SENSOR_NOTE,
      "Benefit depends on purifier size, room size and how sealed the room is.",
    ],
    caution: "Avoid ozone-generating 'ionizer' air cleaners.",
    priority: concern.level >= 3 ? 2 : 3,
  };
};

/** Ventilate while cooking, with stronger advice for solid fuels. */
export const cooking: Rule = ({ preferences, concern }) => {
  const biomass = preferences.cookingFuel === "biomass";
  if ((!concern || concern.level < 1) && !biomass) return null;
  const outdoorPoor = concern !== null && concern.level >= 2;
  let reason = "Indoor cooking emissions add to the particles already coming from outside.";
  if (biomass) reason = "Solid-fuel cooking produces heavy indoor smoke.";
  if (outdoorPoor)
    reason = "Outdoor air is also elevated, so targeted extraction is preferable to opening the whole home.";
  return {
    id: "cooking",
    category: "cooking",
    title: preferences.equipment.kitchenExhaust
      ? "Use the kitchen exhaust every time you cook"
      : "Ventilate the kitchen while cooking",
    description: outdoorPoor
      ? "Remove cooking smoke at the source with an outdoor-vented exhaust or a window fan blowing out, and keep the kitchen door closed, rather than opening every window in the home."
      : "Cooking, especially frying, is a major indoor source of fine particles. Extract or ventilate while cooking and for a while after.",
    reason,
    evidence: concern ? [`${concern.basis}: ${Math.round(concern.value)}`] : [],
    recommendedTime: "While cooking",
    impactType: "indoor-air",
    confidence: "medium",
    source: "General indoor-air guidance, triggered by current outdoor level",
    limitations: [NO_INDOOR_SENSOR_NOTE],
    priority: biomass ? 3 : 5,
  };
};

/** US AQI PM10 sub-index above this, or mineral dust at/above DUST_THRESHOLD µg/m³, triggers dust advice. */
const PM10_SUBINDEX_THRESHOLD = 100;
const DUST_THRESHOLD = 50;

/** Reduce indoor dust when coarse particles (PM10) or desert dust are elevated. */
export const dust: Rule = ({ snapshot, source, confidence }) => {
  const subIndex = snapshot.current.usSubIndices.pm10;
  const dustValue = snapshot.current.pollutants.dust;
  const pm10 = snapshot.current.pollutants.pm10;
  const dusty =
    (subIndex !== null && subIndex > PM10_SUBINDEX_THRESHOLD) ||
    (dustValue !== null && dustValue >= DUST_THRESHOLD);
  if (!dusty) return null;
  return {
    id: "dust",
    category: "dust",
    title: "Reduce dust indoors today",
    description:
      "Damp-dust surfaces, wet-mop floors, leave outdoor shoes at the door and keep windows closed during the dustiest hours.",
    reason: "Coarse particles (PM10) or mineral dust are high in the model.",
    evidence: [
      ...(pm10 !== null ? [`PM10: ${Math.round(pm10)} µg/m³`] : []),
      ...(subIndex !== null ? [`US AQI PM10 sub-index: ${Math.round(subIndex)}`] : []),
      ...(dustValue !== null ? [`Dust: ${Math.round(dustValue)} µg/m³`] : []),
    ],
    recommendedTime: "Today",
    impactType: "indoor-air",
    confidence,
    source,
    limitations: [MODEL_LIMITATION],
    priority: 4,
  };
};
