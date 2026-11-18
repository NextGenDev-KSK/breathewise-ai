import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import type { Confidence, Recommendation } from "@/types/recommendation";
import type { ConcernAssessment } from "@/lib/air/indices";
import type { FormatTime } from "@/lib/time";

export interface EngineInput {
  snapshot: AirQualitySnapshot;
  preferences: Preferences;
  nowMs: number;
  formatTime?: FormatTime;
}

/** Shared, precomputed inputs for every rule. */
export interface RuleContext {
  snapshot: AirQualitySnapshot;
  preferences: Preferences;
  nowMs: number;
  fmt: FormatTime;
  /** Current outdoor concern, or null when no index or PM2.5 value is available. */
  concern: ConcernAssessment | null;
  /** Where the data came from (shown in "Why this recommendation?"). */
  source: string;
  /** Baseline confidence for data-driven advice. */
  confidence: Confidence;
}

/** A rule returns zero, one or several recommendations. */
export type Rule = (ctx: RuleContext) => Recommendation | Recommendation[] | null;
