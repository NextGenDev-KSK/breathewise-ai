import type { AirQualitySnapshot } from "@/types/air";
import type { Activity, Preferences } from "@/types/preferences";
import { hasSensitiveMember } from "@/types/preferences";
import type { Recommendation } from "@/types/recommendation";
import type { AssistantResponse } from "@/lib/ai/schema";
import { POLLUTANTS } from "@/lib/air/pollutants";
import { currentConcern, dominantPollutant, isIndianLocation, isStale } from "@/lib/engine/analysis";
import { generateRecommendations } from "@/lib/engine/recommendations";
import { findOutdoorWindow, windowRange } from "@/lib/engine/windows";
import { buildDailyPlan } from "@/lib/engine/dailyPlan";
import { EMISSION_FACTORS } from "@/lib/engine/emissions";

export type Intent = "outdoor" | "children" | "indoor" | "commute" | "routine" | "education" | "general";

const INTENT_PATTERNS: [Intent, RegExp][] = [
  ["children", /\b(child|children|kid|kids|school|baby|toddler|son|daughter)\b/i],
  ["commute", /\b(commute|commuting|travel|car|bike|scooter|two[- ]?wheeler|metro|bus|train|office trip|emission|emissions|carbon|co2|co₂)\b/i],
  ["routine", /\b(routine|plan|schedule|day plan|my day|family day|daily)\b/i],
  ["outdoor", /\b(walk|walking|run|running|jog|jogging|cycle|cycling|exercise|workout|outdoors?|outside|park|play|go out)\b/i],
  ["indoor", /\b(bedroom|indoor|indoors|home|house|room|purifier|window|windows|ventilat\w*|dust|cook\w*|kitchen|incense|filter)\b/i],
  ["education", /\b(why|what is|what's|explain|pm ?2\.?5|pm ?10|ozone|no2|no₂|so2|pollutant|harmful|concerning|aqi)\b/i],
];

export function detectIntent(message: string): Intent {
  for (const [intent, re] of INTENT_PATTERNS) if (re.test(message)) return intent;
  return "general";
}

function detectActivity(message: string, prefs: Preferences): Activity {
  if (/\b(jog|jogging|run|running)\b/i.test(message)) return "jogging";
  if (/\b(cycle|cycling|bike ride)\b/i.test(message)) return "cycling";
  if (/\b(play|child|children|kid|kids)\b/i.test(message)) return "children_play";
  if (/\b(exercise|workout)\b/i.test(message)) return "exercise";
  if (/\bwalk/i.test(message)) return "walking";
  return prefs.outdoorActivity === "none" ? "walking" : prefs.outdoorActivity;
}

const DISCLAIMER =
  "Rule-based guidance from modelled air-quality data. Not medical advice and no guarantee of protection. Consult a doctor about symptoms.";

function toAction(r: Recommendation) {
  return { action: r.title, why: r.reason, when: r.recommendedTime ?? "When practical" };
}

function pick(recs: Recommendation[], categories: Recommendation["category"][], max = 3): Recommendation[] {
  return recs.filter((r) => categories.includes(r.category)).slice(0, max);
}

export interface FallbackInput {
  message: string;
  snapshot: AirQualitySnapshot | null;
  preferences: Preferences;
  nowMs: number;
  formatTime?: (t: string) => string;
}

/** Deterministic answer used when Gemini is unavailable, disabled or returns invalid output. */
export function buildRuleBasedAnswer({ message, snapshot, preferences, nowMs, formatTime }: FallbackInput): AssistantResponse {
  const fmt = formatTime ?? ((t: string) => t.slice(11));
  const intent = detectIntent(message);

  if (!snapshot) {
    return {
      summary: "No air-quality data is loaded yet, so I can only give general guidance. Choose a location to get advice based on your local forecast.",
      risk_context: "Not available: no location selected or data could not be loaded.",
      top_actions: [{ action: "Select your city on the dashboard", why: "Recommendations depend on local forecast data.", when: "Now" }],
      timing: "Not available without forecast data.",
      indoor_recommendations: ["Ventilate while cooking", "Damp-dust and wet-mop instead of dry sweeping", "Avoid incense and indoor smoking"],
      commute_recommendation: "Public transport, walking or cycling have lower estimated emissions than private vehicles where practical.",
      environmental_impact: "Not calculated without trip details. See Smart Commute.",
      uncertainties: ["No environmental data is available."],
      disclaimer: DISCLAIMER,
    };
  }

  const recs = generateRecommendations({ snapshot, preferences, nowMs, formatTime: fmt });
  const c = currentConcern(snapshot);
  const d = dominantPollutant(snapshot);
  const where = snapshot.origin === "demo" ? "the sample location (demo data)" : snapshot.place.name;
  const riskContext = c
    ? `In ${where}, the modelled ${c.basis} is ${Math.round(c.value)} (${c.standardLabel}), which BreatheWise treats as ${c.label.toLowerCase()} concern.${d ? ` ${POLLUTANTS[d.key].shortLabel} is the main pollutant.` : ""}`
    : `No current index or PM2.5 value is available for ${where}.`;
  const uncertainties = [
    snapshot.origin === "demo" ? "This answer uses SAMPLE data, not real conditions." : "Values come from an atmospheric model, not monitoring stations.",
    ...(snapshot.model.id === "cams_global" ? ["The global model has a ~45 km grid and 3-hour steps; street-level air can differ."] : []),
    ...(isStale(snapshot, nowMs) || snapshot.origin === "cache" ? ["The data may be out of date."] : []),
    ...(isIndianLocation(snapshot) && snapshot.origin !== "demo" ? ["This is not the official CPCB National AQI; check the nearest CPCB station."] : []),
  ].slice(0, 5);

  const indoor = pick(recs, ["ventilation", "indoor", "cooking", "dust"], 4).map((r) => `${r.title}: ${r.description}`);
  const commuteRec = recs.find((r) => r.category === "commute");
  const commuteText = commuteRec
    ? `${commuteRec.title}. ${commuteRec.description}`
    : preferences.commuteMode === "none"
      ? "No commute saved. Set one in My Clean-Air Day for commute-specific advice."
      : `Your ${EMISSION_FACTORS[preferences.commuteMode].label.toLowerCase()} commute already has comparatively low estimated emissions.`;
  const impact =
    "Choosing lower-emission transport mainly reduces greenhouse-gas emissions; it does not measurably change today's local AQI on its own. Indoor actions reduce what you breathe at home.";

  let summary: string;
  let actions: Recommendation[];
  let timing: string;

  switch (intent) {
    case "outdoor":
    case "children": {
      const activity = intent === "children" ? "children_play" : detectActivity(message, preferences);
      const household = intent === "children" ? { ...preferences.household, children: true } : preferences.household;
      const w = findOutdoorWindow(snapshot, { activity, household, nowMs, formatTime: fmt });
      timing = w.best ? `${w.headline}. ${w.reasons.join(" ")}` : "Not enough forecast data to identify a better window.";
      summary =
        w.verdict === "avoid"
          ? `All forecast hours are in a concerning range for ${w.profile.label.toLowerCase()}. An indoor alternative is the more cautious choice.`
          : w.best
            ? `The comparatively better time for ${w.profile.label.toLowerCase()} is ${windowRange(w.best, fmt)}. Comparatively better does not mean risk-free.`
            : "There is not enough forecast data to suggest a time.";
      actions = [
        ...pick(recs, ["outdoor", "household"], 3),
        ...(intent === "children" ? pick(recs, ["indoor", "ventilation"], 1) : []),
      ];
      if (intent === "children") {
        summary += " For school days, check the morning forecast before leaving and keep strenuous outdoor play short when levels are high.";
      }
      break;
    }
    case "indoor":
      summary = "Focus on keeping outdoor pollution out during the worst hours and removing indoor sources.";
      actions = pick(recs, ["ventilation", "indoor", "cooking", "dust"], 4);
      timing = recs.find((r) => r.category === "ventilation")?.recommendedTime ?? "Ventilate when outdoor air is comparatively better.";
      break;
    case "commute":
      summary = commuteText;
      actions = [...pick(recs, ["commute"], 2), ...pick(recs, ["outdoor"], 1)];
      timing = recs.find((r) => r.id === "outdoor-window")?.recommendedTime ?? "Use the forecast to time open-air travel.";
      break;
    case "routine": {
      const plan = buildDailyPlan(snapshot, preferences, nowMs, fmt);
      summary = plan.headline;
      actions = plan.periods.flatMap((p) => p.items.slice(0, 1).map((r) => ({ ...r, recommendedTime: `${p.label}: ${r.recommendedTime ?? "any time"}` })));
      timing = plan.periods.map((p) => `${p.label}: ${p.stats ? `${p.stats.levelLabel.toLowerCase()} concern` : "no data"}`).join("; ");
      break;
    }
    case "education": {
      const key = /pm ?10/i.test(message) ? "pm10" : /ozone|o3/i.test(message) ? "ozone" : /no2|no₂|nitrogen/i.test(message) ? "nitrogen_dioxide" : /so2|sulphur|sulfur/i.test(message) ? "sulphur_dioxide" : "pm2_5";
      const info = POLLUTANTS[key];
      summary = `${info.label}: ${info.description} Common sources: ${info.commonSources}${info.whoGuideline ? ` The WHO 2021 ${info.whoGuideline.averaging} guideline is ${info.whoGuideline.value} ${info.unit}.` : ""}`;
      actions = recs.slice(0, 3);
      timing = recs[0]?.recommendedTime ?? "See the forecast page for timing.";
      break;
    }
    default:
      summary = c ? `Outdoor air is ${c.label.toLowerCase()} concern right now. Here are the most relevant actions for today.` : "Here are general clean-air actions for today.";
      actions = recs.slice(0, 4);
      timing = recs[0]?.recommendedTime ?? "See the forecast page for timing.";
  }

  if (actions.length === 0) actions = recs.slice(0, 3);
  const top = actions.slice(0, 5).map(toAction);
  if (top.length === 0) top.push({ action: "Keep indoor smoke sources low", why: "Indoor sources add to outdoor pollution.", when: "Today" });
  if (hasSensitiveMember(preferences.household) && intent !== "children" && c && c.level >= 2) {
    uncertainties.push("Sensitive household members may need extra caution; follow their doctor's advice.");
  }

  return fitToSchema({
    summary,
    risk_context: riskContext,
    top_actions: top,
    timing,
    indoor_recommendations: indoor,
    commute_recommendation: commuteText,
    environmental_impact: impact,
    uncertainties: uncertainties.slice(0, 5),
    disclaimer: DISCLAIMER,
  });
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

/** Keeps rule-based text within the response schema's limits so it always validates. */
export function fitToSchema(r: AssistantResponse): AssistantResponse {
  return {
    summary: clip(r.summary, 700),
    risk_context: clip(r.risk_context, 700),
    top_actions: r.top_actions.slice(0, 5).map((a) => ({ action: clip(a.action, 200), why: clip(a.why, 400), when: clip(a.when, 120) })),
    timing: clip(r.timing, 400),
    indoor_recommendations: r.indoor_recommendations.slice(0, 5).map((t) => clip(t, 300)),
    commute_recommendation: clip(r.commute_recommendation, 400),
    environmental_impact: clip(r.environmental_impact, 400),
    uncertainties: r.uncertainties.slice(0, 5).map((t) => clip(t, 300)),
    disclaimer: clip(r.disclaimer, 400),
  };
}
