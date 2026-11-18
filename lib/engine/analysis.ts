import {
  US_SUBINDEX_POLLUTANTS,
  type AirQualitySnapshot,
  type HourlyPoint,
  type UsSubIndexPollutant,
} from "@/types/air";
import { assessConcern, type ConcernAssessment, type ConcernMetric } from "@/lib/air/indices";
import { POLLUTANTS } from "@/lib/air/pollutants";
import { maxBy, mean, minBy, presentValues, roundTo } from "@/lib/math";
import { HOUR_MS } from "@/lib/time";

/** Data older than this is labelled stale. CAMS updates every 12–24 h; current values are 15-minutely/hourly. */
const STALE_AFTER_MS = 3 * HOUR_MS;

/** A change of at least this fraction between now and later counts as a trend. */
const TREND_THRESHOLD = 0.2;

/** Concern level for the current hour, from the US AQI, European AQI and PM2.5 available. */
export function currentConcern(s: AirQualitySnapshot): ConcernAssessment | null {
  return assessConcern({
    us_aqi: s.current.usAqi,
    european_aqi: s.current.europeanAqi,
    pm2_5: s.current.pollutants.pm2_5,
  });
}

export interface DominantPollutant {
  key: UsSubIndexPollutant;
  subIndex: number;
  label: string;
}

/** The pollutant with the highest US AQI sub-index (the US EPA definition of the "main" pollutant). */
export function dominantPollutant(s: AirQualitySnapshot): DominantPollutant | null {
  const key = maxBy(US_SUBINDEX_POLLUTANTS, (pollutant) => s.current.usSubIndices[pollutant]);
  if (key === null) return null;
  const subIndex = s.current.usSubIndices[key];
  return subIndex === null ? null : { key, subIndex, label: POLLUTANTS[key].shortLabel };
}

/** True for places in India, where the CPCB National AQI notice applies. */
export function isIndianLocation(s: AirQualitySnapshot): boolean {
  return s.place.countryCode === "IN" || s.timezone === "Asia/Kolkata" || s.timezone === "Asia/Calcutta";
}

/** True when the current hour's data is older than `STALE_AFTER_MS`. */
export function isStale(s: AirQualitySnapshot, nowMs: number): boolean {
  return nowMs - s.current.epochMs > STALE_AFTER_MS;
}

/** Hours from the current hour onward, within a horizon. */
export function upcomingHours(s: AirQualitySnapshot, nowMs: number, horizonHours = 24): HourlyPoint[] {
  const start = nowMs - HOUR_MS + 1; // include the hour in progress
  const end = nowMs + horizonHours * HOUR_MS;
  return s.hourly.filter((h) => h.epochMs >= start && h.epochMs <= end);
}

/** Measures used to rank forecast hours (a subset of the concern metrics). */
export type Metric = Extract<ConcernMetric, "us_aqi" | "european_aqi" | "pm2_5">;

export const METRIC_LABELS: Record<Metric, string> = {
  us_aqi: "US AQI",
  european_aqi: "European AQI",
  pm2_5: "PM2.5 (µg/m³)",
};

/** Values of one metric over some hours, with missing readings removed. */
export function metricValues(hours: readonly HourlyPoint[], metric: Metric): number[] {
  return presentValues(hours.map((h) => h[metric]));
}

/**
 * Chooses one metric for ranking hours so that every compared hour uses the same scale.
 * Hourly PM2.5 concentration comes first: Open-Meteo's US AQI uses a 24-hour rolling
 * average for particles, which lags behind hour-to-hour changes and would point to the
 * wrong hour. Indices are used only when PM2.5 is missing. Prefers the metric present for most hours.
 */
export function chooseMetric(hours: readonly HourlyPoint[]): Metric | null {
  const candidates: readonly Metric[] = ["pm2_5", "us_aqi", "european_aqi"];
  const best = maxBy(candidates, (metric) => {
    const count = metricValues(hours, metric).length;
    return count > 0 ? count : null;
  });
  return best;
}

export type Trend = "improving" | "worsening" | "steady" | "unknown";

export interface TrendSummary {
  trend: Trend;
  metric: Metric | null;
  nowValue: number | null;
  laterValue: number | null;
  /** Local time of the lowest value in the next 12 hours. */
  lowestAt: string | null;
  lowestValue: number | null;
}

const UNKNOWN_TREND: TrendSummary = {
  trend: "unknown",
  metric: null,
  nowValue: null,
  laterValue: null,
  lowestAt: null,
  lowestValue: null,
};

function classifyTrend(nowValue: number | null, laterValue: number | null): Trend {
  if (nowValue === null || laterValue === null || nowValue <= 0) return "unknown";
  const change = (laterValue - nowValue) / nowValue;
  if (change <= -TREND_THRESHOLD) return "improving";
  if (change >= TREND_THRESHOLD) return "worsening";
  return "steady";
}

/** Compares the next 3 hours with hours 6–12 ahead. A change under 20% counts as steady. */
export function summarizeTrend(s: AirQualitySnapshot, nowMs: number): TrendSummary {
  const hours = upcomingHours(s, nowMs, 12);
  const metric = chooseMetric(hours);
  if (!metric) return UNKNOWN_TREND;
  const between = (fromHour: number, toHour: number) =>
    metricValues(
      hours.filter(
        (h) => h.epochMs >= nowMs + (fromHour - 1) * HOUR_MS && h.epochMs < nowMs + toHour * HOUR_MS,
      ),
      metric,
    );
  const nowValue = mean(between(0, 3));
  const laterValue = mean(between(6, 12));
  const lowest = minBy(hours, (h) => h[metric]);
  return {
    trend: classifyTrend(nowValue, laterValue),
    metric,
    nowValue,
    laterValue,
    lowestAt: lowest?.time ?? null,
    lowestValue: lowest?.[metric] ?? null,
  };
}

/** A metric value for display: PM2.5 in µg/m³ to one decimal, indices as whole numbers. */
export function describeMetricValue(metric: Metric, value: number): string {
  return metric === "pm2_5"
    ? `PM2.5 ${roundTo(value, 1)} µg/m³`
    : `${METRIC_LABELS[metric]} ${roundTo(value)}`;
}
