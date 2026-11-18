import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import { hasSensitiveMember } from "@/types/preferences";
import { CONCERN_LABELS, type ConcernAssessment, type ConcernLevel } from "@/lib/air/indices";
import {
  currentConcern,
  describeMetricValue,
  summarizeTrend,
  type TrendSummary,
} from "@/lib/engine/analysis";
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

/** A cleaner hour must be at least this much lower than now to be suggested for airing. */
const BETTER_LATER_RATIO = 0.8;

const NO_DATA_ADVICE: VentilationAdvice = {
  status: "unknown",
  title: "Outdoor air data unavailable",
  description:
    "Ventilate as you normally would for cooking, humidity and freshness, and check back when data returns.",
  reason: "No current outdoor index or PM2.5 value is available.",
  evidence: [],
  nextBetterTime: null,
};

/** The cleanest hour in the next 12 h, when it is clearly better than now, with its evidence line. */
function cleanerTimeLater(
  trend: TrendSummary,
  formatTime: FormatTime,
): { time: string; evidence: string } | null {
  const { lowestAt, lowestValue, nowValue, metric } = trend;
  if (!lowestAt || lowestValue === null || nowValue === null || !metric) return null;
  if (lowestValue >= nowValue * BETTER_LATER_RATIO) return null;
  return {
    time: lowestAt,
    evidence: `Lowest in next 12 h: ${describeMetricValue(metric, lowestValue)} at ${formatTime(lowestAt)}`,
  };
}

type AdviceText = Pick<VentilationAdvice, "status" | "title" | "description" | "reason">;

function adviceText(concern: ConcernAssessment, later: string | null): AdviceText {
  if (concern.level <= 1) {
    return {
      status: "favourable",
      title: "Reasonable time to air out your home",
      description: "Opening windows for a while can clear cooking fumes, humidity and stale indoor air.",
      reason: `Outdoor air is in the ${concern.label.toLowerCase()} concern range.`,
    };
  }
  if (concern.level === 2) {
    return {
      status: "brief",
      title: "Ventilate briefly, when needed",
      description: later
        ? `Keep airing short now. Conditions are forecast to be lower around ${later}, which is a better time for a longer airing.`
        : "Keep airing short and purposeful, for example while cooking or to clear humidity.",
      reason:
        "Outdoor air is elevated, so long periods with windows open bring more outdoor particles inside.",
    };
  }
  return {
    status: "limit",
    title: "Keep windows mostly closed for now",
    description: later
      ? `Avoid opening windows unnecessarily. If you need fresh air, a short airing around ${later} is forecast to bring in less pollution.`
      : "Avoid opening windows unnecessarily. Still ventilate when cooking, if a fuel-burning appliance is in use, or if the room feels stuffy.",
    reason: `Outdoor air is in the ${CONCERN_LABELS[concern.level].toLowerCase()} concern range.`,
  };
}

/** Whether to open windows now, and when a cleaner time to air out is forecast. */
export function getVentilationAdvice(
  snapshot: AirQualitySnapshot,
  nowMs: number,
  formatTime: FormatTime = formatTime24,
): VentilationAdvice {
  const concern = currentConcern(snapshot);
  if (!concern) return NO_DATA_ADVICE;
  const later = cleanerTimeLater(summarizeTrend(snapshot, nowMs), formatTime);
  const now = `Now: ${concern.basis} ${Math.round(concern.value)} (${concern.standardLabel})`;
  return {
    ...adviceText(concern, later ? formatTime(later.time) : null),
    evidence: later ? [now, later.evidence] : [now],
    nextBetterTime: later?.time ?? null,
  };
}

export type ChecklistCategory = "ventilation" | "cooking" | "dust" | "sources" | "purification";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  title: string;
  detail: string;
}

interface ChecklistContext {
  prefs: Preferences;
  /** Outdoor air is in the elevated concern range or worse. */
  elevated: boolean;
}

interface ChecklistEntry extends Omit<ChecklistItem, "title"> {
  title: string | ((ctx: ChecklistContext) => string);
  /** When the item applies; always when omitted. */
  when?: (ctx: ChecklistContext) => boolean;
}

/** Every possible checklist item, in display order. */
const CHECKLIST: readonly ChecklistEntry[] = [
  {
    id: "vent-closed",
    category: "ventilation",
    title: "Keep windows closed during the most polluted hours",
    detail: "Open briefly when needed, preferably at the forecast's cleaner times.",
    when: ({ elevated }) => elevated,
  },
  {
    id: "vent-air-out",
    category: "ventilation",
    title: "Air out the home while outdoor air is reasonable",
    detail: "Cross-ventilate for a while to clear stale air and humidity.",
    when: ({ elevated }) => !elevated,
  },
  {
    id: "cook-exhaust",
    category: "cooking",
    title: "Run the kitchen exhaust while cooking and for a while after",
    detail: "An exhaust vented outdoors removes smoke and gases at the source.",
    when: ({ prefs }) => prefs.equipment.kitchenExhaust,
  },
  {
    id: "cook-ventilate",
    category: "cooking",
    title: "Ventilate the kitchen while cooking",
    detail:
      "Open the kitchen window or use a fan blowing outward; keep the kitchen door closed to other rooms.",
    when: ({ prefs }) => !prefs.equipment.kitchenExhaust,
  },
  {
    id: "cook-biomass",
    category: "cooking",
    title: "Avoid indoor wood, coal or dung fires where an alternative exists",
    detail: "Solid fuels produce heavy indoor smoke; cook outdoors or with cleaner fuel when practical.",
    when: ({ prefs }) => prefs.cookingFuel === "biomass",
  },
  {
    id: "cook-lids",
    category: "cooking",
    title: "Use lids and avoid burning oil",
    detail: "Frying at very high heat produces more smoke and fine particles.",
  },
  {
    id: "dust-damp",
    category: "dust",
    title: "Damp-dust surfaces instead of dry dusting",
    detail: "Dry dusting puts settled particles back into the air.",
  },
  {
    id: "dust-mop",
    category: "dust",
    title: "Wet-mop hard floors",
    detail: "Sweeping stirs up fine dust; a damp mop captures it.",
  },
  {
    id: "dust-shoes",
    category: "dust",
    title: "Leave outdoor shoes at the door",
    detail: "Reduces road dust carried indoors.",
  },
  {
    id: "src-smoke",
    category: "sources",
    title: "Keep the home smoke-free",
    detail: "No indoor smoking; reduce incense, candles and mosquito coils.",
  },
  {
    id: "src-cleaning",
    category: "sources",
    title: "Avoid strong sprays and solvents on high-pollution days",
    detail: "Use fragrance-free products and ventilate when cleaning.",
  },
  {
    id: "pur-run",
    category: "purification",
    title: ({ elevated }) =>
      elevated
        ? "Run the purifier on a higher setting in the main room"
        : "Run the purifier in the room you use most",
    detail: "Close the room's doors and windows while it runs so it can clean the air effectively.",
    when: ({ prefs }) => prefs.equipment.airPurifier,
  },
  {
    id: "pur-filter",
    category: "purification",
    title: "Check the filter and replace it on schedule",
    detail: "A clogged or old filter cleans far less air.",
    when: ({ prefs }) => prefs.equipment.airPurifier,
  },
  {
    id: "pur-clean-room",
    category: "purification",
    title: "Choose one 'cleaner room' to keep closed on bad-air days",
    detail: "Usually the bedroom. A HEPA purifier sized for the room helps most here.",
    when: ({ prefs }) => !prefs.equipment.airPurifier,
  },
  {
    id: "pur-bedroom",
    category: "purification",
    title: "Prioritise the sleeping room of sensitive family members",
    detail: "Keep it closed during polluted hours and clean it with damp methods.",
    when: ({ prefs }) => hasSensitiveMember(prefs.household),
  },
];

/** Builds a personalised indoor checklist. Items depend on equipment, household and outdoor level. */
export function buildIndoorChecklist(prefs: Preferences, level: ConcernLevel | null): ChecklistItem[] {
  const ctx: ChecklistContext = { prefs, elevated: level !== null && level >= 2 };
  return CHECKLIST.filter((entry) => entry.when?.(ctx) ?? true).map(({ when: _when, title, ...item }) => ({
    ...item,
    title: typeof title === "function" ? title(ctx) : title,
  }));
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
