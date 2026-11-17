import type { AirQualitySnapshot, HourlyPoint, UsSubIndexPollutant } from "@/types/air";
import { US_SUBINDEX_POLLUTANTS } from "@/types/air";
import { assessConcern, type ConcernAssessment } from "@/lib/air/indices";
import { POLLUTANTS } from "@/lib/air/pollutants";

/** Data older than this is labelled stale. CAMS updates every 12–24 h; current values are 15-minutely/hourly. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export function currentConcern(s: AirQualitySnapshot): ConcernAssessment | null {
  return assessConcern({
    us_aqi: s.current.usAqi,
    european_aqi: s.current.europeanAqi,
    pm2_5: s.current.pollutants.pm2_5,
  });
}

export function hourConcern(h: HourlyPoint): ConcernAssessment | null {
  return assessConcern({ us_aqi: h.us_aqi, european_aqi: h.european_aqi, pm2_5: h.pm2_5 });
}

export interface DominantPollutant {
  key: UsSubIndexPollutant;
  subIndex: number;
  label: string;
}

/** The pollutant with the highest US AQI sub-index (the US EPA definition of the "main" pollutant). */
export function dominantPollutant(s: AirQualitySnapshot): DominantPollutant | null {
  let best: DominantPollutant | null = null;
  for (const key of US_SUBINDEX_POLLUTANTS) {
    const v = s.current.usSubIndices[key];
    if (v === null) continue;
    if (!best || v > best.subIndex) best = { key, subIndex: v, label: POLLUTANTS[key].shortLabel };
  }
  return best;
}

export function isIndianLocation(s: AirQualitySnapshot): boolean {
  return s.place.countryCode === "IN" || s.timezone === "Asia/Kolkata" || s.timezone === "Asia/Calcutta";
}

export function isStale(s: AirQualitySnapshot, nowMs: number): boolean {
  return nowMs - s.current.epochMs > STALE_AFTER_MS;
}

/** Hours from the current hour onward, within a horizon. */
export function upcomingHours(s: AirQualitySnapshot, nowMs: number, horizonHours = 24): HourlyPoint[] {
  const start = nowMs - 60 * 60 * 1000 + 1; // include the hour in progress
  const end = nowMs + horizonHours * 60 * 60 * 1000;
  return s.hourly.filter((h) => h.epochMs >= start && h.epochMs <= end);
}

export type Metric = "us_aqi" | "european_aqi" | "pm2_5";

export const METRIC_LABELS: Record<Metric, string> = {
  us_aqi: "US AQI",
  european_aqi: "European AQI",
  pm2_5: "PM2.5 (µg/m³)",
};

/**
 * Chooses one metric for ranking hours so that every compared hour uses the same scale.
 * Hourly PM2.5 concentration comes first: Open-Meteo's US AQI uses a 24-hour rolling
 * average for particles, which lags behind hour-to-hour changes and would point to the
 * wrong hour. Indices are used only when PM2.5 is missing. Prefers the metric present for most hours.
 */
export function chooseMetric(hours: HourlyPoint[]): Metric | null {
  const candidates: Metric[] = ["pm2_5", "us_aqi", "european_aqi"];
  let best: { metric: Metric; count: number } | null = null;
  for (const metric of candidates) {
    const count = hours.filter((h) => h[metric] !== null).length;
    if (count > 0 && (!best || count > best.count)) best = { metric, count };
  }
  return best?.metric ?? null;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
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

/** Compares the next 3 hours with hours 6–12 ahead. A change under 20% counts as steady. */
export function summarizeTrend(s: AirQualitySnapshot, nowMs: number): TrendSummary {
  const hours = upcomingHours(s, nowMs, 12);
  const metric = chooseMetric(hours);
  if (!metric) return { trend: "unknown", metric: null, nowValue: null, laterValue: null, lowestAt: null, lowestValue: null };
  const values = (from: number, to: number) =>
    hours
      .filter((h) => h.epochMs >= nowMs + from * 3_600_000 - 3_600_000 && h.epochMs < nowMs + to * 3_600_000)
      .map((h) => h[metric])
      .filter((v): v is number => v !== null);
  const nowValue = mean(values(0, 3));
  const laterValue = mean(values(6, 12));
  let lowest: HourlyPoint | null = null;
  for (const h of hours) {
    const v = h[metric];
    if (v !== null && (lowest === null || v < (lowest[metric] as number))) lowest = h;
  }
  let trend: Trend = "unknown";
  if (nowValue !== null && laterValue !== null && nowValue > 0) {
    const change = (laterValue - nowValue) / nowValue;
    trend = change <= -0.2 ? "improving" : change >= 0.2 ? "worsening" : "steady";
  }
  return {
    trend,
    metric,
    nowValue,
    laterValue,
    lowestAt: lowest?.time ?? null,
    lowestValue: lowest ? (lowest[metric] as number) : null,
  };
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function describeMetricValue(metric: Metric, value: number): string {
  return metric === "pm2_5" ? `PM2.5 ${round(value, 1)} µg/m³` : `${METRIC_LABELS[metric]} ${round(value)}`;
}
