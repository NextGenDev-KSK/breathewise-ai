import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import { hasSensitiveMember } from "@/types/preferences";
import type { ConcernLevel } from "@/lib/air/indices";
import { CONCERN_LABELS } from "@/lib/air/indices";
import { currentConcern, describeMetricValue, summarizeTrend } from "@/lib/engine/analysis";
import { formatTime24, type FormatTime } from "@/lib/time";

export type VentilationStatus = "favourable" | "brief" | "limit" | "unknown";

export interface VentilationAdvice {
  status: VentilationStatus;
  title: string;
  description: string;
  reason: string;
  evidence: string[];
  /** Local time of the comparatively cleanest hour in the next 12 hours, if it is better than now. */
  nextBetterTime: string | null;
}

export function getVentilationAdvice(
  snapshot: AirQualitySnapshot,
  nowMs: number,
  formatTime: FormatTime = formatTime24,
): VentilationAdvice {
  const concern = currentConcern(snapshot);
  const trend = summarizeTrend(snapshot, nowMs);
  if (!concern) {
    return {
      status: "unknown",
      title: "Outdoor air data unavailable",
      description:
        "Ventilate as you normally would for cooking, humidity and freshness, and check back when data returns.",
      reason: "No current outdoor index or PM2.5 value is available.",
      evidence: [],
      nextBetterTime: null,
    };
  }
  const evidence = [`Now: ${concern.basis} ${Math.round(concern.value)} (${concern.standardLabel})`];
  const betterLater =
    trend.lowestAt !== null &&
    trend.lowestValue !== null &&
    trend.nowValue !== null &&
    trend.lowestValue < trend.nowValue * 0.8;
  if (betterLater && trend.metric && trend.lowestValue !== null && trend.lowestAt) {
    evidence.push(
      `Lowest in next 12 h: ${describeMetricValue(trend.metric, trend.lowestValue)} at ${formatTime(trend.lowestAt)}`,
    );
  }
  const nextBetterTime = betterLater ? trend.lowestAt : null;

  if (concern.level <= 1) {
    return {
      status: "favourable",
      title: "Reasonable time to air out your home",
      description: "Opening windows for a while can clear cooking fumes, humidity and stale indoor air.",
      reason: `Outdoor air is in the ${concern.label.toLowerCase()} concern range.`,
      evidence,
      nextBetterTime,
    };
  }
  if (concern.level === 2) {
    return {
      status: "brief",
      title: "Ventilate briefly, when needed",
      description: nextBetterTime
        ? `Keep airing short now. Conditions are forecast to be lower around ${formatTime(nextBetterTime)}, which is a better time for a longer airing.`
        : "Keep airing short and purposeful, for example while cooking or to clear humidity.",
      reason:
        "Outdoor air is elevated, so long periods with windows open bring more outdoor particles inside.",
      evidence,
      nextBetterTime,
    };
  }
  return {
    status: "limit",
    title: "Keep windows mostly closed for now",
    description: nextBetterTime
      ? `Avoid opening windows unnecessarily. If you need fresh air, a short airing around ${formatTime(nextBetterTime)} is forecast to bring in less pollution.`
      : "Avoid opening windows unnecessarily. Still ventilate when cooking, if a fuel-burning appliance is in use, or if the room feels stuffy.",
    reason: `Outdoor air is in the ${CONCERN_LABELS[concern.level].toLowerCase()} concern range.`,
    evidence,
    nextBetterTime,
  };
}

export type ChecklistCategory = "ventilation" | "cooking" | "dust" | "sources" | "purification";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  title: string;
  detail: string;
}

/** Builds a personalised indoor checklist. Items depend on equipment, household and outdoor level. */
export function buildIndoorChecklist(prefs: Preferences, level: ConcernLevel | null): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const elevated = level !== null && level >= 2;

  items.push(
    elevated
      ? {
          id: "vent-closed",
          category: "ventilation",
          title: "Keep windows closed during the most polluted hours",
          detail: "Open briefly when needed, preferably at the forecast's cleaner times.",
        }
      : {
          id: "vent-air-out",
          category: "ventilation",
          title: "Air out the home while outdoor air is reasonable",
          detail: "Cross-ventilate for a while to clear stale air and humidity.",
        },
  );
  items.push(
    prefs.equipment.kitchenExhaust
      ? {
          id: "cook-exhaust",
          category: "cooking",
          title: "Run the kitchen exhaust while cooking and for a while after",
          detail: "An exhaust vented outdoors removes smoke and gases at the source.",
        }
      : {
          id: "cook-ventilate",
          category: "cooking",
          title: "Ventilate the kitchen while cooking",
          detail:
            "Open the kitchen window or use a fan blowing outward; keep the kitchen door closed to other rooms.",
        },
  );
  if (prefs.cookingFuel === "biomass") {
    items.push({
      id: "cook-biomass",
      category: "cooking",
      title: "Avoid indoor wood, coal or dung fires where an alternative exists",
      detail: "Solid fuels produce heavy indoor smoke; cook outdoors or with cleaner fuel when practical.",
    });
  }
  items.push({
    id: "cook-lids",
    category: "cooking",
    title: "Use lids and avoid burning oil",
    detail: "Frying at very high heat produces more smoke and fine particles.",
  });
  items.push({
    id: "dust-damp",
    category: "dust",
    title: "Damp-dust surfaces instead of dry dusting",
    detail: "Dry dusting puts settled particles back into the air.",
  });
  items.push({
    id: "dust-mop",
    category: "dust",
    title: "Wet-mop hard floors",
    detail: "Sweeping stirs up fine dust; a damp mop captures it.",
  });
  items.push({
    id: "dust-shoes",
    category: "dust",
    title: "Leave outdoor shoes at the door",
    detail: "Reduces road dust carried indoors.",
  });
  items.push({
    id: "src-smoke",
    category: "sources",
    title: "Keep the home smoke-free",
    detail: "No indoor smoking; reduce incense, candles and mosquito coils.",
  });
  items.push({
    id: "src-cleaning",
    category: "sources",
    title: "Avoid strong sprays and solvents on high-pollution days",
    detail: "Use fragrance-free products and ventilate when cleaning.",
  });

  if (prefs.equipment.airPurifier) {
    items.push({
      id: "pur-run",
      category: "purification",
      title: elevated
        ? "Run the purifier on a higher setting in the main room"
        : "Run the purifier in the room you use most",
      detail: "Close the room's doors and windows while it runs so it can clean the air effectively.",
    });
    items.push({
      id: "pur-filter",
      category: "purification",
      title: "Check the filter and replace it on schedule",
      detail: "A clogged or old filter cleans far less air.",
    });
  } else {
    items.push({
      id: "pur-clean-room",
      category: "purification",
      title: "Choose one 'cleaner room' to keep closed on bad-air days",
      detail: "Usually the bedroom. A HEPA purifier sized for the room helps most here.",
    });
  }
  if (hasSensitiveMember(prefs.household)) {
    items.push({
      id: "pur-bedroom",
      category: "purification",
      title: "Prioritise the sleeping room of sensitive family members",
      detail: "Keep it closed during polluted hours and clean it with damp methods.",
    });
  }
  return items;
}

/**
 * AHAM rule of thumb: a purifier's smoke CADR (cfm) should be at least 2/3 of the room
 * area in square feet. Returns the suggested minimum in both cfm and m³/h.
 */
export function recommendedCadr(roomAreaM2: number): { cfm: number; m3h: number } | null {
  if (!Number.isFinite(roomAreaM2) || roomAreaM2 <= 0 || roomAreaM2 > 500) return null;
  const sqft = roomAreaM2 * 10.7639;
  const cfm = (sqft * 2) / 3;
  return { cfm: Math.ceil(cfm), m3h: Math.ceil(cfm * 1.699) };
}
