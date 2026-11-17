/**
 * Index band mapping for explicitly supported standards only.
 * India's CPCB National AQI is intentionally NOT computed here: it requires
 * station measurements and averaging periods that model data cannot provide.
 */

/** A neutral 0–5 concern scale used by the recommendation engine. */
export type ConcernLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const CONCERN_LABELS: Record<ConcernLevel, string> = {
  0: "Low",
  1: "Moderate",
  2: "Elevated",
  3: "High",
  4: "Very high",
  5: "Severe",
};

export interface IndexBand {
  max: number;
  label: string;
  level: ConcernLevel;
}

export type IndexStandard = "us" | "eu";

/** US EPA AQI categories as documented by Open-Meteo. */
export const US_AQI_BANDS: IndexBand[] = [
  { max: 50, label: "Good", level: 0 },
  { max: 100, label: "Moderate", level: 1 },
  { max: 150, label: "Unhealthy for Sensitive Groups", level: 2 },
  { max: 200, label: "Unhealthy", level: 3 },
  { max: 300, label: "Very Unhealthy", level: 4 },
  { max: Number.POSITIVE_INFINITY, label: "Hazardous", level: 5 },
];

/** European Environment Agency AQI bands (2024 revision) as documented by Open-Meteo. */
export const EU_AQI_BANDS: IndexBand[] = [
  { max: 20, label: "Good", level: 0 },
  { max: 40, label: "Fair", level: 1 },
  { max: 60, label: "Moderate", level: 2 },
  { max: 80, label: "Poor", level: 3 },
  { max: 100, label: "Very poor", level: 4 },
  { max: Number.POSITIVE_INFINITY, label: "Extremely poor", level: 5 },
];

/**
 * PM2.5 concentration bands (µg/m³) from the US EPA 2024 breakpoints.
 * Used only when no index is available; applied to an hourly model value, so approximate.
 */
export const PM25_BANDS: IndexBand[] = [
  { max: 9, label: "Low", level: 0 },
  { max: 35.4, label: "Moderate", level: 1 },
  { max: 55.4, label: "Elevated", level: 2 },
  { max: 125.4, label: "High", level: 3 },
  { max: 225.4, label: "Very high", level: 4 },
  { max: Number.POSITIVE_INFINITY, label: "Severe", level: 5 },
];

export const STANDARD_NAMES: Record<IndexStandard, string> = {
  us: "US AQI (US EPA)",
  eu: "European AQI (EEA)",
};

function bandFor(value: number, bands: IndexBand[]): IndexBand {
  // Bands are ordered and the last one is unbounded, so a match always exists.
  return bands.find((b) => value <= b.max) ?? (bands[bands.length - 1] as IndexBand);
}

export function usAqiBand(value: number | null): IndexBand | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return bandFor(value, US_AQI_BANDS);
}

export function euAqiBand(value: number | null): IndexBand | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return bandFor(value, EU_AQI_BANDS);
}

export function pm25Band(value: number | null): IndexBand | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return bandFor(value, PM25_BANDS);
}

export function indexBand(standard: IndexStandard, value: number | null): IndexBand | null {
  return standard === "us" ? usAqiBand(value) : euAqiBand(value);
}

export interface ConcernAssessment {
  level: ConcernLevel;
  label: string;
  /** Which standard or measure the level was derived from. */
  basis: "US AQI" | "European AQI" | "PM2.5 concentration";
  value: number;
  /** The standard's own category name, e.g. "Unhealthy for Sensitive Groups". */
  standardLabel: string;
}

/**
 * Derives a concern level from whichever measure is available, preferring
 * the US AQI, then the European AQI, then raw PM2.5. Returns null when nothing is available.
 */
export function assessConcern(values: {
  us_aqi: number | null;
  european_aqi: number | null;
  pm2_5: number | null;
}): ConcernAssessment | null {
  const us = usAqiBand(values.us_aqi);
  if (us && values.us_aqi !== null) {
    return { level: us.level, label: CONCERN_LABELS[us.level], basis: "US AQI", value: values.us_aqi, standardLabel: us.label };
  }
  const eu = euAqiBand(values.european_aqi);
  if (eu && values.european_aqi !== null) {
    return { level: eu.level, label: CONCERN_LABELS[eu.level], basis: "European AQI", value: values.european_aqi, standardLabel: eu.label };
  }
  const pm = pm25Band(values.pm2_5);
  if (pm && values.pm2_5 !== null) {
    return { level: pm.level, label: CONCERN_LABELS[pm.level], basis: "PM2.5 concentration", value: values.pm2_5, standardLabel: pm.label };
  }
  return null;
}
