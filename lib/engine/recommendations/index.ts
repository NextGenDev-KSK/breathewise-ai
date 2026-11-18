import type { Recommendation } from "@/types/recommendation";
import { currentConcern } from "@/lib/engine/analysis";
import { baseConfidence, sourceLabel } from "@/lib/engine/provenance";
import { formatTime24 } from "@/lib/time";
import { dataReliability, dominantPollutantRule } from "@/lib/engine/recommendations/awareness";
import { commute } from "@/lib/engine/recommendations/commute";
import { cooking, dust, purification, ventilation } from "@/lib/engine/recommendations/home";
import { outdoorTiming, sensitiveHousehold, trend } from "@/lib/engine/recommendations/outdoor";
import type { EngineInput, Rule, RuleContext } from "@/lib/engine/recommendations/types";

export type { EngineInput } from "@/lib/engine/recommendations/types";

/** Every rule, in tie-break order: when priorities are equal, earlier rules come first. */
const RULES: readonly Rule[] = [
  outdoorTiming,
  sensitiveHousehold,
  ventilation,
  purification,
  trend,
  dust,
  cooking,
  commute,
  dominantPollutantRule,
  dataReliability,
];

/** Runs every rule and returns recommendations sorted by priority (stable within equal priority). */
export function generateRecommendations(input: EngineInput): Recommendation[] {
  const ctx: RuleContext = {
    snapshot: input.snapshot,
    preferences: input.preferences,
    nowMs: input.nowMs,
    fmt: input.formatTime ?? formatTime24,
    concern: currentConcern(input.snapshot),
    source: sourceLabel(input.snapshot),
    confidence: baseConfidence(input.snapshot, input.nowMs),
  };
  const results = RULES.flatMap((rule) => {
    const result = rule(ctx);
    if (result === null) return [];
    return Array.isArray(result) ? result : [result];
  });
  // Array.prototype.sort is stable, so equal priorities keep rule order.
  return results.sort((a, b) => a.priority - b.priority);
}
