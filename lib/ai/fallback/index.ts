import type { AirQualitySnapshot } from "@/types/air";
import { hasSensitiveMember, type Preferences } from "@/types/preferences";
import type { Recommendation, RecommendationCategory } from "@/types/recommendation";
import { RESPONSE_LIMITS, type AssistantResponse } from "@/lib/ai/schema";
import { detectActivity, detectIntent, detectPollutant, type Intent } from "@/lib/ai/fallback/intents";
import type { ConcernAssessment } from "@/lib/air/indices";
import { POLLUTANTS } from "@/lib/air/pollutants";
import { currentConcern, dominantPollutant, isIndianLocation, isStale } from "@/lib/engine/analysis";
import { EMISSION_FACTORS } from "@/lib/engine/emissions";
import { buildDailyPlan } from "@/lib/engine/plan";
import { generateRecommendations } from "@/lib/engine/recommendations";
import { findOutdoorWindow, windowRange } from "@/lib/engine/windows";
import { formatTime24, type FormatTime } from "@/lib/time";

export { detectIntent, type Intent } from "@/lib/ai/fallback/intents";

const DISCLAIMER =
  "Rule-based guidance from modelled air-quality data. Not medical advice and no guarantee of protection. Consult a doctor about symptoms.";

const ENVIRONMENTAL_IMPACT =
  "Choosing lower-emission transport mainly reduces greenhouse-gas emissions; it does not measurably change today's local AQI on its own. Indoor actions reduce what you breathe at home.";

const INDOOR_CATEGORIES: readonly RecommendationCategory[] = ["ventilation", "indoor", "cooking", "dust"];

export interface FallbackInput {
  message: string;
  snapshot: AirQualitySnapshot | null;
  preferences: Preferences;
  nowMs: number;
  formatTime?: FormatTime;
}

interface IntentContext {
  message: string;
  snapshot: AirQualitySnapshot;
  preferences: Preferences;
  nowMs: number;
  fmt: FormatTime;
  recs: Recommendation[];
  concern: ConcernAssessment | null;
  commuteText: string;
}

/** The parts of an answer that depend on what was asked. */
interface IntentAnswer {
  summary: string;
  actions: Recommendation[];
  timing: string;
}

type IntentHandler = (ctx: IntentContext) => IntentAnswer;

function pick(
  recs: readonly Recommendation[],
  categories: readonly RecommendationCategory[],
  max = 3,
): Recommendation[] {
  return recs.filter((r) => categories.includes(r.category)).slice(0, max);
}

function activityAnswer(ctx: IntentContext, forChildren: boolean): IntentAnswer {
  const { snapshot, preferences, nowMs, fmt, recs } = ctx;
  const activity = forChildren ? "children_play" : detectActivity(ctx.message, preferences);
  const household = forChildren ? { ...preferences.household, children: true } : preferences.household;
  const window = findOutdoorWindow(snapshot, { activity, household, nowMs, formatTime: fmt });
  const label = window.profile.label.toLowerCase();

  let summary = "There is not enough forecast data to suggest a time.";
  if (window.verdict === "avoid") {
    summary = `All forecast hours are in a concerning range for ${label}. An indoor alternative is the more cautious choice.`;
  } else if (window.best) {
    summary = `The comparatively better time for ${label} is ${windowRange(window.best, fmt)}. Comparatively better does not mean risk-free.`;
  }
  if (forChildren) {
    summary +=
      " For school days, check the morning forecast before leaving and keep strenuous outdoor play short when levels are high.";
  }
  return {
    summary,
    actions: [
      ...pick(recs, ["outdoor", "household"]),
      ...(forChildren ? pick(recs, ["indoor", "ventilation"], 1) : []),
    ],
    timing: window.best
      ? `${window.headline}. ${window.reasons.join(" ")}`
      : "Not enough forecast data to identify a better window.",
  };
}

const HANDLERS: Record<Intent, IntentHandler> = {
  outdoor: (ctx) => activityAnswer(ctx, false),
  children: (ctx) => activityAnswer(ctx, true),
  indoor: ({ recs }) => ({
    summary: "Focus on keeping outdoor pollution out during the worst hours and removing indoor sources.",
    actions: pick(recs, INDOOR_CATEGORIES, 4),
    timing:
      recs.find((r) => r.category === "ventilation")?.recommendedTime ??
      "Ventilate when outdoor air is comparatively better.",
  }),
  commute: ({ recs, commuteText }) => ({
    summary: commuteText,
    actions: [...pick(recs, ["commute"], 2), ...pick(recs, ["outdoor"], 1)],
    timing:
      recs.find((r) => r.id === "outdoor-window")?.recommendedTime ??
      "Use the forecast to time open-air travel.",
  }),
  routine: ({ snapshot, preferences, nowMs, fmt }) => {
    const plan = buildDailyPlan(snapshot, preferences, nowMs, fmt);
    return {
      summary: plan.headline,
      actions: plan.periods.flatMap((p) =>
        p.items
          .slice(0, 1)
          .map((r) => ({ ...r, recommendedTime: `${p.label}: ${r.recommendedTime ?? "any time"}` })),
      ),
      timing: plan.periods
        .map((p) => `${p.label}: ${p.stats ? `${p.stats.levelLabel.toLowerCase()} concern` : "no data"}`)
        .join("; "),
    };
  },
  education: ({ message, recs }) => {
    const info = POLLUTANTS[detectPollutant(message)];
    const guideline = info.whoGuideline
      ? ` The WHO 2021 ${info.whoGuideline.averaging} guideline is ${info.whoGuideline.value} ${info.unit}.`
      : "";
    return {
      summary: `${info.label}: ${info.description} Common sources: ${info.commonSources}${guideline}`,
      actions: recs.slice(0, 3),
      timing: recs[0]?.recommendedTime ?? "See the forecast page for timing.",
    };
  },
  general: ({ recs, concern }) => ({
    summary: concern
      ? `Outdoor air is ${concern.label.toLowerCase()} concern right now. Here are the most relevant actions for today.`
      : "Here are general clean-air actions for today.",
    actions: recs.slice(0, 4),
    timing: recs[0]?.recommendedTime ?? "See the forecast page for timing.",
  }),
};

const NO_DATA_ANSWER: AssistantResponse = {
  summary:
    "No air-quality data is loaded yet, so I can only give general guidance. Choose a location to get advice based on your local forecast.",
  risk_context: "Not available: no location selected or data could not be loaded.",
  top_actions: [
    {
      action: "Select your city on the dashboard",
      why: "Recommendations depend on local forecast data.",
      when: "Now",
    },
  ],
  timing: "Not available without forecast data.",
  indoor_recommendations: [
    "Ventilate while cooking",
    "Damp-dust and wet-mop instead of dry sweeping",
    "Avoid incense and indoor smoking",
  ],
  commute_recommendation:
    "Public transport, walking or cycling have lower estimated emissions than private vehicles where practical.",
  environmental_impact: "Not calculated without trip details. See Smart Commute.",
  uncertainties: ["No environmental data is available."],
  disclaimer: DISCLAIMER,
};

function riskContext(snapshot: AirQualitySnapshot, concern: ConcernAssessment | null): string {
  const where = snapshot.origin === "demo" ? "the sample location (demo data)" : snapshot.place.name;
  if (!concern) return `No current index or PM2.5 value is available for ${where}.`;
  const dominant = dominantPollutant(snapshot);
  const main = dominant ? ` ${POLLUTANTS[dominant.key].shortLabel} is the main pollutant.` : "";
  return `In ${where}, the modelled ${concern.basis} is ${Math.round(concern.value)} (${concern.standardLabel}), which BreatheWise treats as ${concern.label.toLowerCase()} concern.${main}`;
}

function uncertaintiesFor(snapshot: AirQualitySnapshot, nowMs: number, extraCaution: boolean): string[] {
  const notes = [
    snapshot.origin === "demo"
      ? "This answer uses SAMPLE data, not real conditions."
      : "Values come from an atmospheric model, not monitoring stations.",
  ];
  if (snapshot.model.id === "cams_global") {
    notes.push("The global model has a ~45 km grid and 3-hour steps; street-level air can differ.");
  }
  if (isStale(snapshot, nowMs) || snapshot.origin === "cache") notes.push("The data may be out of date.");
  if (isIndianLocation(snapshot) && snapshot.origin !== "demo") {
    notes.push("This is not the official CPCB National AQI; check the nearest CPCB station.");
  }
  if (extraCaution)
    notes.push("Sensitive household members may need extra caution; follow their doctor's advice.");
  return notes;
}

function commuteSummary(recs: readonly Recommendation[], preferences: Preferences): string {
  const commuteRec = recs.find((r) => r.category === "commute");
  if (commuteRec) return `${commuteRec.title}. ${commuteRec.description}`;
  if (preferences.commuteMode === "none") {
    return "No commute saved. Set one in My Clean-Air Day for commute-specific advice.";
  }
  return `Your ${EMISSION_FACTORS[preferences.commuteMode].label.toLowerCase()} commute already has comparatively low estimated emissions.`;
}

/** Deterministic answer used when Gemini is unavailable, disabled or returns invalid output. */
export function buildRuleBasedAnswer({
  message,
  snapshot,
  preferences,
  nowMs,
  formatTime = formatTime24,
}: FallbackInput): AssistantResponse {
  if (!snapshot) return NO_DATA_ANSWER;

  const intent = detectIntent(message);
  const recs = generateRecommendations({ snapshot, preferences, nowMs, formatTime });
  const concern = currentConcern(snapshot);
  const commuteText = commuteSummary(recs, preferences);
  const answer = HANDLERS[intent]({
    message,
    snapshot,
    preferences,
    nowMs,
    fmt: formatTime,
    recs,
    concern,
    commuteText,
  });

  const actions = answer.actions.length > 0 ? answer.actions : recs.slice(0, 3);
  const topActions = actions.map((r) => ({
    action: r.title,
    why: r.reason,
    when: r.recommendedTime ?? "When practical",
  }));
  const extraCaution =
    hasSensitiveMember(preferences.household) &&
    intent !== "children" &&
    concern !== null &&
    concern.level >= 2;

  return fitToSchema({
    summary: answer.summary,
    risk_context: riskContext(snapshot, concern),
    top_actions: topActions.length
      ? topActions
      : [
          {
            action: "Keep indoor smoke sources low",
            why: "Indoor sources add to outdoor pollution.",
            when: "Today",
          },
        ],
    timing: answer.timing,
    indoor_recommendations: pick(recs, INDOOR_CATEGORIES, 4).map((r) => `${r.title}: ${r.description}`),
    commute_recommendation: commuteText,
    environmental_impact: ENVIRONMENTAL_IMPACT,
    uncertainties: uncertaintiesFor(snapshot, nowMs, extraCaution),
    disclaimer: DISCLAIMER,
  });
}

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** Keeps rule-based text within the response schema's limits so it always validates. */
function fitToSchema(r: AssistantResponse): AssistantResponse {
  const L = RESPONSE_LIMITS;
  const list = <T>(items: readonly T[]) => items.slice(0, L.listItems);
  return {
    summary: clip(r.summary, L.summary),
    risk_context: clip(r.risk_context, L.riskContext),
    top_actions: list(r.top_actions).map((a) => ({
      action: clip(a.action, L.action),
      why: clip(a.why, L.why),
      when: clip(a.when, L.when),
    })),
    timing: clip(r.timing, L.timing),
    indoor_recommendations: list(r.indoor_recommendations).map((t) => clip(t, L.indoorItem)),
    commute_recommendation: clip(r.commute_recommendation, L.commute),
    environmental_impact: clip(r.environmental_impact, L.impact),
    uncertainties: list(r.uncertainties).map((t) => clip(t, L.uncertainty)),
    disclaimer: clip(r.disclaimer, L.disclaimer),
  };
}
