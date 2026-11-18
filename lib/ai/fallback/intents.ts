import type { UsSubIndexPollutant } from "@/types/air";
import type { Activity, Preferences } from "@/types/preferences";

/** What a question is mainly about; the rule-based assistant answers each intent differently. */
export type Intent = "outdoor" | "children" | "indoor" | "commute" | "routine" | "education" | "general";

/** Checked in order: the first matching pattern wins (children before outdoor, for example). */
const INTENT_PATTERNS: readonly (readonly [Intent, RegExp])[] = [
  ["children", /\b(child|children|kid|kids|school|baby|toddler|son|daughter)\b/i],
  [
    "commute",
    /\b(commute|commuting|travel|car|bike|scooter|two[- ]?wheeler|metro|bus|train|office trip|emission|emissions|carbon|co2|co₂)\b/i,
  ],
  ["routine", /\b(routine|plan|schedule|day plan|my day|family day|daily)\b/i],
  [
    "outdoor",
    /\b(walk|walking|run|running|jog|jogging|cycle|cycling|exercise|workout|outdoors?|outside|park|play|go out)\b/i,
  ],
  [
    "indoor",
    /\b(bedroom|indoor|indoors|home|house|room|purifier|window|windows|ventilat\w*|dust|cook\w*|kitchen|incense|filter)\b/i,
  ],
  [
    "education",
    /\b(why|what is|what's|explain|pm ?2\.?5|pm ?10|ozone|no2|no₂|so2|pollutant|harmful|concerning|aqi)\b/i,
  ],
];

/** Classifies a question by the first matching keyword pattern; `general` when nothing matches. */
export function detectIntent(message: string): Intent {
  return INTENT_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0] ?? "general";
}

const ACTIVITY_PATTERNS: readonly (readonly [Activity, RegExp])[] = [
  ["jogging", /\b(jog|jogging|run|running)\b/i],
  ["cycling", /\b(cycle|cycling|bike ride)\b/i],
  ["children_play", /\b(play|child|children|kid|kids)\b/i],
  ["exercise", /\b(exercise|workout)\b/i],
  ["walking", /\bwalk/i],
];

/** The activity named in a question, else the user's usual activity, else walking. */
export function detectActivity(message: string, prefs: Preferences): Activity {
  const named = ACTIVITY_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0];
  if (named) return named;
  return prefs.outdoorActivity === "none" ? "walking" : prefs.outdoorActivity;
}

const POLLUTANT_PATTERNS: readonly (readonly [UsSubIndexPollutant, RegExp])[] = [
  ["pm10", /pm ?10/i],
  ["ozone", /ozone|o3/i],
  ["nitrogen_dioxide", /no2|no₂|nitrogen/i],
  ["sulphur_dioxide", /so2|sulphur|sulfur/i],
];

/** The pollutant a question asks about; PM2.5 when none is named. */
export function detectPollutant(message: string): UsSubIndexPollutant {
  return POLLUTANT_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0] ?? "pm2_5";
}
