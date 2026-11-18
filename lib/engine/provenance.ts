import type { AirQualitySnapshot } from "@/types/air";
import type { Confidence } from "@/types/recommendation";
import { SAMPLE_DATA_SOURCE } from "@/lib/content/notices";
import { isStale } from "@/lib/engine/analysis";

/** Where a recommendation's data came from, as shown in "Why this recommendation?". */
export function sourceLabel(snapshot: AirQualitySnapshot): string {
  return snapshot.origin === "demo" ? SAMPLE_DATA_SOURCE : `${snapshot.model.name}, via Open-Meteo`;
}

/**
 * Baseline confidence for data-driven advice: high for current European-model data, medium for
 * current global-model data, low for sample, saved or stale data.
 */
export function baseConfidence(snapshot: AirQualitySnapshot, nowMs: number): Confidence {
  if (snapshot.origin !== "live" || isStale(snapshot, nowMs)) return "low";
  return snapshot.model.id === "cams_europe" ? "high" : "medium";
}
