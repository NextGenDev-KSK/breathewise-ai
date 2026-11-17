import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import { hasSensitiveMember } from "@/types/preferences";
import type { Confidence, Recommendation } from "@/types/recommendation";
import { POLLUTANTS } from "@/lib/air/pollutants";
import {
  currentConcern,
  describeMetricValue,
  dominantPollutant,
  isIndianLocation,
  isStale,
  summarizeTrend,
} from "@/lib/engine/analysis";
import { findOutdoorWindow, windowRange } from "@/lib/engine/windows";
import { getVentilationAdvice, NO_INDOOR_SENSOR_NOTE } from "@/lib/engine/indoor";
import { EMISSION_FACTORS, EMISSION_SOURCE, savingPerKm } from "@/lib/engine/emissions";
import { formatAge } from "@/lib/time";

export interface EngineInput {
  snapshot: AirQualitySnapshot;
  preferences: Preferences;
  nowMs: number;
  formatTime?: (localTime: string) => string;
}

export const MODEL_LIMITATION = "Based on modelled forecasts, not monitoring-station measurements.";
export const CPCB_URL = "https://airquality.cpcb.gov.in/AQI_India/";

function sourceLabel(s: AirQualitySnapshot): string {
  if (s.origin === "demo") return "Sample demo data (not real readings)";
  return `${s.model.name}, via Open-Meteo`;
}

function baseConfidence(s: AirQualitySnapshot, nowMs: number): Confidence {
  if (s.origin === "demo") return "low";
  if (isStale(s, nowMs) || s.origin === "cache") return "low";
  return s.model.id === "cams_europe" ? "high" : "medium";
}

type Rule = (input: EngineInput & { fmt: (t: string) => string }) => Recommendation | Recommendation[] | null;

const ruleDataFreshness: Rule = ({ snapshot, nowMs }) => {
  const out: Recommendation[] = [];
  if (snapshot.origin === "cache" || isStale(snapshot, nowMs)) {
    out.push({
      id: "data-stale",
      category: "data",
      title: "Data may be out of date",
      description: "Refresh when you are online before relying on today's timing advice.",
      reason: `The latest available reading is from ${formatAge(snapshot.current.epochMs, nowMs)}${snapshot.origin === "cache" ? " and is a saved copy" : ""}.`,
      evidence: [`Reading time: ${snapshot.current.time} (${snapshot.timezoneAbbreviation || snapshot.timezone})`],
      recommendedTime: "Now",
      impactType: "awareness",
      confidence: "high",
      source: sourceLabel(snapshot),
      limitations: [],
      priority: 2,
    });
  }
  if (isIndianLocation(snapshot) && snapshot.origin !== "demo") {
    out.push({
      id: "data-cpcb",
      category: "data",
      title: "Compare with the official CPCB station AQI",
      description: "India's National AQI is published by CPCB from monitoring stations. Check the nearest station for an official reading.",
      reason: "BreatheWise shows model estimates and international indices, which are not the Indian National AQI.",
      evidence: [`Model grid: ${snapshot.model.spatialResolution}`],
      recommendedTime: null,
      impactType: "awareness",
      confidence: "high",
      source: CPCB_URL,
      limitations: ["Station readings describe the area around the station, which may differ from your street."],
      priority: 7,
    });
  }
  return out;
};

const ruleOutdoorTiming: Rule = ({ snapshot, preferences, nowMs, fmt }) => {
  const activity = preferences.outdoorActivity === "none" ? "walking" : preferences.outdoorActivity;
  const w = findOutdoorWindow(snapshot, { activity, household: preferences.household, nowMs, formatTime: fmt });
  if (w.status !== "ok" || !w.best) return null;
  const label = w.profile.label;
  const range = windowRange(w.best, fmt);
  const titles = {
    reasonable: `Better time for ${label.toLowerCase()}: ${range}`,
    reduce: `Keep ${label.toLowerCase()} short; best around ${range}`,
    avoid: `Consider an indoor alternative to ${label.toLowerCase()}`,
    unknown: "",
  } as const;
  return {
    id: "outdoor-window",
    category: "outdoor",
    title: titles[w.verdict],
    description:
      w.verdict === "avoid"
        ? `Every forecast hour today is in a concerning range for ${label.toLowerCase()}. If you go out, ${range} is comparatively lower.`
        : `This is the comparatively cleanest ${w.profile.durationHours}-hour slot in the next 24 hours. Comparatively better does not mean risk-free.`,
    reason: w.reasons.join(" "),
    evidence: [`Best: ${describeMetricValue(w.metric ?? "pm2_5", w.best.meanValue)} at ${fmt(w.best.startTime)}`, ...(w.worst ? [`Worst: ${describeMetricValue(w.metric ?? "pm2_5", w.worst.meanValue)} at ${fmt(w.worst.startTime)}`] : [])],
    recommendedTime: range,
    impactType: "exposure-reduction",
    confidence: w.uncertain ? "low" : baseConfidence(snapshot, nowMs),
    source: sourceLabel(snapshot),
    limitations: w.uncertaintyNotes,
    caution: w.cautions.join(" ") || undefined,
    priority: w.verdict === "avoid" ? 1 : w.verdict === "reduce" ? 2 : 4,
  };
};

const ruleSensitiveHousehold: Rule = ({ snapshot, preferences, nowMs }) => {
  const c = currentConcern(snapshot);
  if (!c || c.level < 2 || !hasSensitiveMember(preferences.household)) return null;
  const who = [
    preferences.household.children && "children",
    preferences.household.olderAdults && "older adults",
    preferences.household.respiratorySensitivity && "anyone with respiratory sensitivity",
  ].filter(Boolean).join(", ");
  return {
    id: "household-sensitive",
    category: "household",
    title: "Extra care for sensitive family members today",
    description: `For ${who}: limit long or strenuous time outdoors, keep their main room closed and clean, and follow any plan agreed with their doctor.`,
    reason: `Outdoor air is ${c.label.toLowerCase()} (${c.basis} ${Math.round(c.value)}: ${c.standardLabel}), and these groups are generally more affected.`,
    evidence: [`${c.basis}: ${Math.round(c.value)}`],
    recommendedTime: "Today",
    impactType: "exposure-reduction",
    confidence: baseConfidence(snapshot, nowMs),
    source: sourceLabel(snapshot),
    limitations: [MODEL_LIMITATION, "This is general guidance, not medical advice."],
    caution: "Seek medical advice for breathing difficulty or worsening symptoms.",
    priority: c.level >= 3 ? 1 : 2,
  };
};

const ruleVentilation: Rule = ({ snapshot, nowMs, fmt }) => {
  const v = getVentilationAdvice(snapshot, nowMs, fmt);
  if (v.status === "unknown") return null;
  return {
    id: "ventilation",
    category: "ventilation",
    title: v.title,
    description: v.description,
    reason: v.reason,
    evidence: v.evidence,
    recommendedTime: v.nextBetterTime ? `Around ${fmt(v.nextBetterTime)}` : v.status === "favourable" ? "Now" : "Only when needed",
    impactType: "indoor-air",
    confidence: baseConfidence(snapshot, nowMs),
    source: sourceLabel(snapshot),
    limitations: [NO_INDOOR_SENSOR_NOTE],
    caution: v.status === "limit" ? "Always ventilate when using gas, kerosene or other fuel-burning appliances indoors." : undefined,
    priority: v.status === "limit" ? 2 : 5,
  };
};

const rulePurification: Rule = ({ snapshot, preferences }) => {
  const c = currentConcern(snapshot);
  if (!c || c.level < 2) return null;
  const has = preferences.equipment.airPurifier;
  return {
    id: "purification",
    category: "indoor",
    title: has ? "Run your air purifier in the room you use most" : "Set up one cleaner room",
    description: has
      ? "Keep that room's doors and windows closed while the purifier runs, and use a higher setting during the worst hours."
      : "Pick one room (often the bedroom), keep it closed during polluted hours, and clean it with damp methods. A correctly sized HEPA purifier helps most.",
    reason: `Outdoor particle levels are ${c.label.toLowerCase()}; filtration is the most direct way to lower indoor particles.`,
    evidence: [`${c.basis}: ${Math.round(c.value)} (${c.standardLabel})`],
    recommendedTime: "During polluted hours",
    impactType: "indoor-air",
    confidence: "medium",
    source: sourceLabel(snapshot),
    limitations: [NO_INDOOR_SENSOR_NOTE, "Benefit depends on purifier size, room size and how sealed the room is."],
    caution: "Avoid ozone-generating 'ionizer' air cleaners.",
    priority: c.level >= 3 ? 2 : 3,
  };
};

const ruleCooking: Rule = ({ snapshot, preferences }) => {
  const c = currentConcern(snapshot);
  if ((!c || c.level < 1) && preferences.cookingFuel !== "biomass") return null;
  const outdoorPoor = c !== null && c.level >= 2;
  return {
    id: "cooking",
    category: "cooking",
    title: preferences.equipment.kitchenExhaust ? "Use the kitchen exhaust every time you cook" : "Ventilate the kitchen while cooking",
    description: outdoorPoor
      ? "Remove cooking smoke at the source with an outdoor-vented exhaust or a window fan blowing out, and keep the kitchen door closed, rather than opening every window in the home."
      : "Cooking, especially frying, is a major indoor source of fine particles. Extract or ventilate while cooking and for a while after.",
    reason: outdoorPoor
      ? "Outdoor air is also elevated, so targeted extraction is preferable to opening the whole home."
      : preferences.cookingFuel === "biomass"
        ? "Solid-fuel cooking produces heavy indoor smoke."
        : "Indoor cooking emissions add to the particles already coming from outside.",
    evidence: c ? [`${c.basis}: ${Math.round(c.value)}`] : [],
    recommendedTime: "While cooking",
    impactType: "indoor-air",
    confidence: "medium",
    source: "General indoor-air guidance, triggered by current outdoor level",
    limitations: [NO_INDOOR_SENSOR_NOTE],
    priority: preferences.cookingFuel === "biomass" ? 3 : 5,
  };
};

const ruleDust: Rule = ({ snapshot, nowMs }) => {
  const sub = snapshot.current.usSubIndices.pm10;
  const dust = snapshot.current.pollutants.dust;
  const pm10 = snapshot.current.pollutants.pm10;
  const dusty = (sub !== null && sub > 100) || (dust !== null && dust >= 50);
  if (!dusty) return null;
  return {
    id: "dust",
    category: "dust",
    title: "Reduce dust indoors today",
    description: "Damp-dust surfaces, wet-mop floors, leave outdoor shoes at the door and keep windows closed during the dustiest hours.",
    reason: "Coarse particles (PM10) or mineral dust are high in the model.",
    evidence: [
      ...(pm10 !== null ? [`PM10: ${Math.round(pm10)} µg/m³`] : []),
      ...(sub !== null ? [`US AQI PM10 sub-index: ${Math.round(sub)}`] : []),
      ...(dust !== null ? [`Dust: ${Math.round(dust)} µg/m³`] : []),
    ],
    recommendedTime: "Today",
    impactType: "indoor-air",
    confidence: baseConfidence(snapshot, nowMs),
    source: sourceLabel(snapshot),
    limitations: [MODEL_LIMITATION],
    priority: 4,
  };
};

const ruleCommute: Rule = ({ snapshot, preferences }) => {
  const mode = preferences.commuteMode;
  if (mode === "none") return null;
  const c = currentConcern(snapshot);
  if (mode === "car" || mode === "two_wheeler") {
    const alt = "metro" as const;
    const saving = savingPerKm(mode, alt);
    return {
      id: "commute-lower-emission",
      category: "commute",
      title: `Try public transport for some ${EMISSION_FACTORS[mode].label.toLowerCase()} trips`,
      description: `Where metro or bus is practical, each passenger-km switched from ${EMISSION_FACTORS[mode].label.toLowerCase()} to metro avoids roughly ${saving} g CO₂e in the reference case study. Use the Smart Commute tool to estimate your own trips.`,
      reason: "Lower-emission travel reduces greenhouse-gas emissions and, collectively, traffic pollution.",
      evidence: [`${EMISSION_FACTORS[mode].label}: ~${EMISSION_FACTORS[mode].gramsPerPassengerKm} g CO₂e/pkm`, `Metro: ~${EMISSION_FACTORS.metro.gramsPerPassengerKm} g CO₂e/pkm`],
      recommendedTime: "Next commute",
      impactType: "emissions-reduction",
      confidence: "medium",
      source: EMISSION_SOURCE.title,
      limitations: ["Illustrative life-cycle factors for an Indian case study; actual emissions vary.", "A CO₂e reduction is not a measurable change in today's local AQI."],
      priority: 6,
    };
  }
  if ((mode === "walk" || mode === "cycle") && c && c.level >= 3) {
    return {
      id: "commute-exposure",
      category: "commute",
      title: "Time your walk or ride, or use enclosed transport today",
      description: "Walking and cycling keep emissions at zero, but you breathe roadside air directly. On high-pollution days, shift the trip to a cleaner hour or take an enclosed bus or metro where practical.",
      reason: `Outdoor air is ${c.label.toLowerCase()} (${c.basis} ${Math.round(c.value)}).`,
      evidence: [`${c.basis}: ${Math.round(c.value)}`],
      recommendedTime: "Today",
      impactType: "exposure-reduction",
      confidence: "medium",
      source: sourceLabel(snapshot),
      limitations: [MODEL_LIMITATION, "No route-level pollution data is available, so no route is claimed to be cleaner."],
      priority: 3,
    };
  }
  return null;
};

const POLLUTANT_TIPS: Record<string, string> = {
  pm2_5: "Fine particles come mainly from combustion: traffic, burning of waste or crop residue, and industry. Avoid burning anything at home.",
  pm10: "Coarse particles are often road and construction dust. Damp cleaning and keeping windows closed during dusty hours help indoors.",
  ozone: "Ozone forms in sunlight and typically peaks in the afternoon; mornings and evenings are usually lower.",
  nitrogen_dioxide: "NO₂ is mostly from traffic, so it is usually highest close to busy roads and during rush hours.",
  sulphur_dioxide: "SO₂ is usually linked to industry or power plants upwind.",
  carbon_monoxide: "CO comes from incomplete combustion; never run generators or charcoal stoves indoors.",
};

const ruleDominantPollutant: Rule = ({ snapshot, nowMs }) => {
  const d = dominantPollutant(snapshot);
  if (!d || d.subIndex <= 50) return null;
  return {
    id: `pollutant-${d.key}`,
    category: "education",
    title: `${POLLUTANTS[d.key].shortLabel} is driving today's index`,
    description: POLLUTANT_TIPS[d.key] ?? POLLUTANTS[d.key].description,
    reason: `${POLLUTANTS[d.key].shortLabel} has the highest US AQI sub-index (${Math.round(d.subIndex)}) of the modelled pollutants.`,
    evidence: [`US AQI ${POLLUTANTS[d.key].shortLabel} sub-index: ${Math.round(d.subIndex)}`],
    recommendedTime: null,
    impactType: "awareness",
    confidence: baseConfidence(snapshot, nowMs),
    source: sourceLabel(snapshot),
    limitations: [MODEL_LIMITATION],
    priority: 6,
  };
};

const ruleTrend: Rule = ({ snapshot, nowMs, fmt }) => {
  const t = summarizeTrend(snapshot, nowMs);
  if (t.trend === "steady" || t.trend === "unknown" || !t.metric || t.nowValue === null || t.laterValue === null) return null;
  const improving = t.trend === "improving";
  return {
    id: `trend-${t.trend}`,
    category: "outdoor",
    title: improving ? "Air is forecast to improve later" : "Air is forecast to get worse later",
    description: improving
      ? "If your plans are flexible, outdoor errands and airing out the home are better later in the day."
      : "If you need to be outside, earlier is better. Plan to keep windows closed later.",
    reason: `Forecast ${t.metric === "pm2_5" ? "PM2.5" : "index"} goes from about ${Math.round(t.nowValue)} in the next 3 hours to about ${Math.round(t.laterValue)} in 6–12 hours.`,
    evidence: [
      `Next 3 h average: ${describeMetricValue(t.metric, t.nowValue)}`,
      `6–12 h average: ${describeMetricValue(t.metric, t.laterValue)}`,
      ...(t.lowestAt && t.lowestValue !== null ? [`Lowest: ${describeMetricValue(t.metric, t.lowestValue)} at ${fmt(t.lowestAt)}`] : []),
    ],
    recommendedTime: improving && t.lowestAt ? `After ${fmt(t.lowestAt)}` : "Earlier rather than later",
    impactType: "exposure-reduction",
    confidence: baseConfidence(snapshot, nowMs) === "high" ? "medium" : "low",
    source: sourceLabel(snapshot),
    limitations: [MODEL_LIMITATION, "Forecasts become less certain further ahead."],
    priority: 3,
  };
};

export const RULES: Rule[] = [
  ruleOutdoorTiming,
  ruleSensitiveHousehold,
  ruleVentilation,
  rulePurification,
  ruleTrend,
  ruleDust,
  ruleCooking,
  ruleCommute,
  ruleDominantPollutant,
  ruleDataFreshness,
];

/** Runs every rule and returns recommendations sorted by priority (stable within equal priority). */
export function generateRecommendations(input: EngineInput): Recommendation[] {
  const fmt = input.formatTime ?? ((t: string) => t.slice(11));
  const results: Recommendation[] = [];
  for (const rule of RULES) {
    const r = rule({ ...input, fmt });
    if (Array.isArray(r)) results.push(...r);
    else if (r) results.push(r);
  }
  return results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.priority - b.r.priority || a.i - b.i)
    .map(({ r }) => r);
}
