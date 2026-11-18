import type { UsSubIndexPollutant } from "@/types/air";
import type { Recommendation } from "@/types/recommendation";
import { POLLUTANTS } from "@/lib/air/pollutants";
import { CPCB_URL, MODEL_LIMITATION } from "@/lib/content/notices";
import { dominantPollutant, isIndianLocation, isStale } from "@/lib/engine/analysis";
import type { Rule } from "@/lib/engine/recommendations/types";
import { formatAge } from "@/lib/time";

/** Sub-index above which the dominant pollutant gets its own explanation (US AQI "Moderate" and up). */
const DOMINANT_SUBINDEX_THRESHOLD = 50;

const POLLUTANT_TIPS: Record<UsSubIndexPollutant, string> = {
  pm2_5:
    "Fine particles come mainly from combustion: traffic, burning of waste or crop residue, and industry. Avoid burning anything at home.",
  pm10: "Coarse particles are often road and construction dust. Damp cleaning and keeping windows closed during dusty hours help indoors.",
  ozone:
    "Ozone forms in sunlight and typically peaks in the afternoon; mornings and evenings are usually lower.",
  nitrogen_dioxide:
    "NO₂ is mostly from traffic, so it is usually highest close to busy roads and during rush hours.",
  sulphur_dioxide: "SO₂ is usually linked to industry or power plants upwind.",
  carbon_monoxide: "CO comes from incomplete combustion; never run generators or charcoal stoves indoors.",
};

/** Explains which pollutant drives today's index and where it usually comes from. */
export const dominantPollutantRule: Rule = ({ snapshot, source, confidence }) => {
  const dominant = dominantPollutant(snapshot);
  if (!dominant || dominant.subIndex <= DOMINANT_SUBINDEX_THRESHOLD) return null;
  const name = POLLUTANTS[dominant.key].shortLabel;
  return {
    id: `pollutant-${dominant.key}`,
    category: "education",
    title: `${name} is driving today's index`,
    description: POLLUTANT_TIPS[dominant.key],
    reason: `${name} has the highest US AQI sub-index (${Math.round(dominant.subIndex)}) of the modelled pollutants.`,
    evidence: [`US AQI ${name} sub-index: ${Math.round(dominant.subIndex)}`],
    recommendedTime: null,
    impactType: "awareness",
    confidence,
    source,
    limitations: [MODEL_LIMITATION],
    priority: 6,
  };
};

/** Flags stale or saved data, and points Indian users to official CPCB station readings. */
export const dataReliability: Rule = ({ snapshot, nowMs, source }) => {
  const notices: Recommendation[] = [];
  if (snapshot.origin === "cache" || isStale(snapshot, nowMs)) {
    notices.push({
      id: "data-stale",
      category: "data",
      title: "Data may be out of date",
      description: "Refresh when you are online before relying on today's timing advice.",
      reason: `The latest available reading is from ${formatAge(snapshot.current.epochMs, nowMs)}${snapshot.origin === "cache" ? " and is a saved copy" : ""}.`,
      evidence: [
        `Reading time: ${snapshot.current.time} (${snapshot.timezoneAbbreviation || snapshot.timezone})`,
      ],
      recommendedTime: "Now",
      impactType: "awareness",
      confidence: "high",
      source,
      limitations: [],
      priority: 2,
    });
  }
  if (isIndianLocation(snapshot) && snapshot.origin !== "demo") {
    notices.push({
      id: "data-cpcb",
      category: "data",
      title: "Compare with the official CPCB station AQI",
      description:
        "India's National AQI is published by CPCB from monitoring stations. Check the nearest station for an official reading.",
      reason:
        "BreatheWise shows model estimates and international indices, which are not the Indian National AQI.",
      evidence: [`Model grid: ${snapshot.model.spatialResolution}`],
      recommendedTime: null,
      impactType: "awareness",
      confidence: "high",
      source: CPCB_URL,
      limitations: [
        "Station readings describe the area around the station, which may differ from your street.",
      ],
      priority: 7,
    });
  }
  return notices;
};
