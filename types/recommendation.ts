export type RecommendationCategory =
  | "outdoor"
  | "household"
  | "ventilation"
  | "indoor"
  | "cooking"
  | "dust"
  | "commute"
  | "education"
  | "data";

/** What kind of benefit an action plausibly offers. Never a quantified health outcome. */
export type ImpactType = "exposure-reduction" | "indoor-air" | "emissions-reduction" | "awareness";

export type Confidence = "high" | "medium" | "low";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  /** Why this was recommended, in plain language. */
  reason: string;
  /** Specific data points that triggered the rule. */
  evidence: string[];
  recommendedTime: string | null;
  impactType: ImpactType;
  confidence: Confidence;
  /** Where the triggering data came from. */
  source: string;
  limitations: string[];
  caution?: string;
  /** 1 = most important. */
  priority: number;
}
