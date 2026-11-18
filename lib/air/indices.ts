/**
 * Index band mapping for explicitly supported standards only.
 * India's CPCB National AQI is intentionally NOT computed here: it requires
 * station measurements and averaging periods that model data cannot provide.
 */

/** A neutral 0–5 concern scale used by the recommendation engine. */
export type ConcernLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Every concern level, lowest first (for legends and loops). */
export const CONCERN_LEVELS: readonly ConcernLevel[] = [0, 1, 2, 3, 4, 5];

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

/** Ordered bands plus an explicit unbounded top band, so a lookup always succeeds. */
interface BandScale {
  bounded: readonly IndexBand[];
  top: IndexBand;
}

export type IndexStandard = "us" | "eu";

/** US EPA AQI categories as documented by Open-Meteo. */
const US_AQI_SCALE: BandScale = {
  bounded: [
    { max: 50, label: "Good", level: 0 },
    { max: 100, label: "Moderate", level: 1 },
    { max: 150, label: "Unhealthy for Sensitive Groups", level: 2 },
    { max: 200, label: "Unhealthy", level: 3 },
    { max: 300, label: "Very Unhealthy", level: 4 },
  ],
  top: { max: Number.POSITIVE_INFINITY, label: "Hazardous", level: 5 },
};

/** European Environment Agency AQI bands (2024 revision) as documented by Open-Meteo. */
const EU_AQI_SCALE: BandScale = {
  bounded: [
    { max: 20, label: "Good", level: 0 },
    { max: 40, label: "Fair", level: 1 },
    { max: 60, label: "Moderate", level: 2 },
    { max: 80, label: "Poor", level: 3 },
    { max: 100, label: "Very poor", level: 4 },
  ],
  top: { max: Number.POSITIVE_INFINITY, label: "Extremely poor", level: 5 },
};

/**
 * PM2.5 concentration bands (µg/m³) from the US EPA 2024 breakpoints.
 * Used only when no index is available; applied to an hourly model value, so approximate.
 */
const PM25_SCALE: BandScale = {
  bounded: [
    { max: 9, label: "Low", level: 0 },
    { max: 35.4, label: "Moderate", level: 1 },
    { max: 55.4, label: "Elevated", level: 2 },
    { max: 125.4, label: "High", level: 3 },
    { max: 225.4, label: "Very high", level: 4 },
  ],
  top: { max: Number.POSITIVE_INFINITY, label: "Severe", level: 5 },
};

/** PM10 concentration bands (µg/m³, US EPA 24-hour breakpoints), used for chart colouring only. */
const PM10_SCALE: BandScale = {
  bounded: [
    { max: 54, label: "Low", level: 0 },
    { max: 154, label: "Moderate", level: 1 },
    { max: 254, label: "Elevated", level: 2 },
    { max: 354, label: "High", level: 3 },
    { max: 424, label: "Very high", level: 4 },
  ],
  top: { max: Number.POSITIVE_INFINITY, label: "Severe", level: 5 },
};

export const STANDARD_NAMES: Record<IndexStandard, string> = {
  us: "US AQI (US EPA)",
  eu: "European AQI (EEA)",
};

/** Returns the band for a value, or null for missing, negative or non-finite values. */
function bandIn(scale: BandScale, value: number | null): IndexBand | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return scale.bounded.find((band) => value <= band.max) ?? scale.top;
}

/** US EPA AQI band for a value, or null when the value is missing or invalid. */
export function usAqiBand(value: number | null): IndexBand | null {
  return bandIn(US_AQI_SCALE, value);
}

/** European (EEA) AQI band for a value, or null when the value is missing or invalid. */
export function euAqiBand(value: number | null): IndexBand | null {
  return bandIn(EU_AQI_SCALE, value);
}

/** PM2.5 concentration band (US EPA 2024 breakpoints), or null when missing or invalid. */
export function pm25Band(value: number | null): IndexBand | null {
  return bandIn(PM25_SCALE, value);
}

/** Band on the user's chosen index scale. */
export function indexBand(standard: IndexStandard, value: number | null): IndexBand | null {
  return standard === "us" ? usAqiBand(value) : euAqiBand(value);
}

/** Measures that can be mapped onto the 0–5 concern scale. */
export type ConcernMetric = "us_aqi" | "european_aqi" | "pm2_5" | "pm10";

const SCALES: Record<ConcernMetric, BandScale> = {
  us_aqi: US_AQI_SCALE,
  european_aqi: EU_AQI_SCALE,
  pm2_5: PM25_SCALE,
  pm10: PM10_SCALE,
};

/** Concern level for one value of one measure; null when the value is missing or invalid. */
export function concernLevelFor(metric: ConcernMetric, value: number | null): ConcernLevel | null {
  return bandIn(SCALES[metric], value)?.level ?? null;
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
  const sources = [
    { basis: "US AQI", value: values.us_aqi, scale: US_AQI_SCALE },
    { basis: "European AQI", value: values.european_aqi, scale: EU_AQI_SCALE },
    { basis: "PM2.5 concentration", value: values.pm2_5, scale: PM25_SCALE },
  ] as const;
  for (const { basis, value, scale } of sources) {
    const band = bandIn(scale, value);
    if (band && value !== null) {
      return {
        level: band.level,
        label: CONCERN_LABELS[band.level],
        basis,
        value,
        standardLabel: band.label,
      };
    }
  }
  return null;
}
