import { hasSensitiveMember } from "@/types/preferences";
import { MODEL_LIMITATION } from "@/lib/content/notices";
import { describeMetricValue, summarizeTrend, type Metric, type TrendSummary } from "@/lib/engine/analysis";
import { findOutdoorWindow, windowRange } from "@/lib/engine/windows";
import type { Rule } from "@/lib/engine/recommendations/types";

/** The comparatively cleanest time for the user's usual outdoor activity. */
export const outdoorTiming: Rule = ({ snapshot, preferences, nowMs, fmt, source, confidence }) => {
  const activity = preferences.outdoorActivity === "none" ? "walking" : preferences.outdoorActivity;
  const window = findOutdoorWindow(snapshot, {
    activity,
    household: preferences.household,
    nowMs,
    formatTime: fmt,
  });
  if (window.status !== "ok" || !window.best || !window.metric) return null;

  const { best, worst, metric, verdict } = window;
  const label = window.profile.label.toLowerCase();
  const range = windowRange(best, fmt);
  const titles = {
    reasonable: `Better time for ${label}: ${range}`,
    reduce: `Keep ${label} short; best around ${range}`,
    avoid: `Consider an indoor alternative to ${label}`,
    unknown: "",
  } as const;
  const priorities = { avoid: 1, reduce: 2, reasonable: 4, unknown: 4 } as const;
  return {
    id: "outdoor-window",
    category: "outdoor",
    title: titles[verdict],
    description:
      verdict === "avoid"
        ? `Every forecast hour today is in a concerning range for ${label}. If you go out, ${range} is comparatively lower.`
        : `This is the comparatively cleanest ${window.profile.durationHours}-hour slot in the next 24 hours. Comparatively better does not mean risk-free.`,
    reason: window.reasons.join(" "),
    evidence: [
      `Best: ${describeMetricValue(metric, best.meanValue)} at ${fmt(best.startTime)}`,
      ...(worst ? [`Worst: ${describeMetricValue(metric, worst.meanValue)} at ${fmt(worst.startTime)}`] : []),
    ],
    recommendedTime: range,
    impactType: "exposure-reduction",
    confidence: window.uncertain ? "low" : confidence,
    source,
    limitations: window.uncertaintyNotes,
    caution: window.cautions.join(" ") || undefined,
    priority: priorities[verdict],
  };
};

/** Extra caution when children, older adults or sensitive people live in the home. */
export const sensitiveHousehold: Rule = ({ preferences, concern, source, confidence }) => {
  const { household } = preferences;
  if (!concern || concern.level < 2 || !hasSensitiveMember(household)) return null;
  const who = [
    household.children ? "children" : null,
    household.olderAdults ? "older adults" : null,
    household.respiratorySensitivity ? "anyone with respiratory sensitivity" : null,
  ]
    .filter((group): group is string => group !== null)
    .join(", ");
  return {
    id: "household-sensitive",
    category: "household",
    title: "Extra care for sensitive family members today",
    description: `For ${who}: limit long or strenuous time outdoors, keep their main room closed and clean, and follow any plan agreed with their doctor.`,
    reason: `Outdoor air is ${concern.label.toLowerCase()} (${concern.basis} ${Math.round(concern.value)}: ${concern.standardLabel}), and these groups are generally more affected.`,
    evidence: [`${concern.basis}: ${Math.round(concern.value)}`],
    recommendedTime: "Today",
    impactType: "exposure-reduction",
    confidence,
    source,
    limitations: [MODEL_LIMITATION, "This is general guidance, not medical advice."],
    caution: "Seek medical advice for breathing difficulty or worsening symptoms.",
    priority: concern.level >= 3 ? 1 : 2,
  };
};

/** A trend worth acting on: clearly improving or worsening, with both averages available. */
interface ActionableTrend {
  direction: "improving" | "worsening";
  metric: Metric;
  nowValue: number;
  laterValue: number;
  lowest: { at: string; value: number } | null;
}

function actionableTrend(summary: TrendSummary): ActionableTrend | null {
  const { trend: direction, metric, nowValue, laterValue, lowestAt, lowestValue } = summary;
  if (direction !== "improving" && direction !== "worsening") return null;
  if (!metric || nowValue === null || laterValue === null) return null;
  const lowest = lowestAt && lowestValue !== null ? { at: lowestAt, value: lowestValue } : null;
  return { direction, metric, nowValue, laterValue, lowest };
}

const TREND_TEXT = {
  improving: {
    title: "Air is forecast to improve later",
    description:
      "If your plans are flexible, outdoor errands and airing out the home are better later in the day.",
  },
  worsening: {
    title: "Air is forecast to get worse later",
    description: "If you need to be outside, earlier is better. Plan to keep windows closed later.",
  },
} as const;

/** Whether air is forecast to get noticeably better or worse in the next 12 hours. */
export const trend: Rule = ({ snapshot, nowMs, fmt, source, confidence }) => {
  const found = actionableTrend(summarizeTrend(snapshot, nowMs));
  if (!found) return null;
  const { direction, metric, nowValue, laterValue, lowest } = found;
  const improving = direction === "improving";
  const lowestEvidence = lowest
    ? [`Lowest: ${describeMetricValue(metric, lowest.value)} at ${fmt(lowest.at)}`]
    : [];
  return {
    id: `trend-${direction}`,
    category: "outdoor",
    ...TREND_TEXT[direction],
    reason: `Forecast ${metric === "pm2_5" ? "PM2.5" : "index"} goes from about ${Math.round(nowValue)} in the next 3 hours to about ${Math.round(laterValue)} in 6–12 hours.`,
    evidence: [
      `Next 3 h average: ${describeMetricValue(metric, nowValue)}`,
      `6–12 h average: ${describeMetricValue(metric, laterValue)}`,
      ...lowestEvidence,
    ],
    recommendedTime: improving && lowest ? `After ${fmt(lowest.at)}` : "Earlier rather than later",
    impactType: "exposure-reduction",
    // Forecasts further ahead are less certain than current readings.
    confidence: confidence === "high" ? "medium" : "low",
    source,
    limitations: [MODEL_LIMITATION, "Forecasts become less certain further ahead."],
    priority: 3,
  };
};
