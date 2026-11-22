import type { ConcernLevel } from "@/lib/air/indices";

/**
 * India's National Air Quality Index (CPCB, 2014), computed from monitoring-station measurements.
 *
 * Method, as published by CPCB:
 * - PM2.5, PM10, NO2, SO2 and NH3 use 24-hour averages; O3 and CO use the highest 8-hour average.
 * - A 24-hour average needs at least 16 hourly values.
 * - The index needs at least three pollutants, one of which must be PM2.5 or PM10.
 * - The overall index is the highest sub-index; that pollutant is the "prominent" one.
 *
 * The published tables use integer ranges (0–30, 31–60, …). They are applied here as continuous bands
 * (0–30, above 30 to 60, …) so fractional averages never fall into a gap. Above the Severe threshold
 * CPCB defines no upper concentration, so the sub-index is reported as "401+" rather than extrapolated.
 */

export const NAQI_POLLUTANTS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "carbon_monoxide",
  "ammonia",
] as const;
export type NaqiPollutant = (typeof NAQI_POLLUTANTS)[number];

export type NaqiCategory = "Good" | "Satisfactory" | "Moderately polluted" | "Poor" | "Very poor" | "Severe";

/** Upper index value of each category below Severe. */
const INDEX_HIGHS = [50, 100, 200, 300, 400] as const;

interface CategoryInfo {
  category: NaqiCategory;
  level: ConcernLevel;
}

const BOUNDED_CATEGORIES: readonly CategoryInfo[] = [
  { category: "Good", level: 0 },
  { category: "Satisfactory", level: 1 },
  { category: "Moderately polluted", level: 2 },
  { category: "Poor", level: 3 },
  { category: "Very poor", level: 4 },
];
const SEVERE: CategoryInfo = { category: "Severe", level: 5 };

interface PollutantRule {
  label: string;
  /** Concentration at the top of each category below Severe, in `unit`. */
  highs: readonly [number, number, number, number, number];
  unit: "µg/m³" | "mg/m³";
  averaging: "24h" | "8h";
}

/** CPCB breakpoint tables (National Air Quality Index, 2014). */
export const NAQI_RULES: Record<NaqiPollutant, PollutantRule> = {
  pm2_5: { label: "PM2.5", highs: [30, 60, 90, 120, 250], unit: "µg/m³", averaging: "24h" },
  pm10: { label: "PM10", highs: [50, 100, 250, 350, 430], unit: "µg/m³", averaging: "24h" },
  nitrogen_dioxide: { label: "NO₂", highs: [40, 80, 180, 280, 400], unit: "µg/m³", averaging: "24h" },
  sulphur_dioxide: { label: "SO₂", highs: [40, 80, 380, 800, 1600], unit: "µg/m³", averaging: "24h" },
  ammonia: { label: "NH₃", highs: [200, 400, 800, 1200, 1800], unit: "µg/m³", averaging: "24h" },
  ozone: { label: "O₃", highs: [50, 100, 168, 208, 748], unit: "µg/m³", averaging: "8h" },
  carbon_monoxide: { label: "CO", highs: [1, 2, 10, 17, 34], unit: "mg/m³", averaging: "8h" },
};

/** Minimum hourly values for a valid 24-hour average (CPCB). */
export const MIN_HOURS_24H = 16;
/** Minimum hourly values in one 8-hour window (75 %, the same share CPCB requires for 24 hours). */
export const MIN_HOURS_8H = 6;
const MIN_POLLUTANTS = 3;

export interface SubIndex {
  pollutant: NaqiPollutant;
  label: string;
  /** Averaged concentration the sub-index was computed from, in the rule's unit. */
  concentration: number;
  /** 0–400, or 401 when `aboveScale` (shown as "401+"). */
  index: number;
  aboveScale: boolean;
}

export type NaqiResult =
  | {
      ok: true;
      index: number;
      aboveScale: boolean;
      category: NaqiCategory;
      level: ConcernLevel;
      prominent: SubIndex;
      subIndices: SubIndex[];
    }
  | { ok: false; reason: string; subIndices: SubIndex[] };

/** One linear segment of a breakpoint table: concentrations (cLow, cHigh] map to indices (iLow, iHigh]. */
interface Segment {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

function segments(highs: readonly number[]): Segment[] {
  return highs.map((cHigh, band) => ({
    cLow: highs[band - 1] ?? 0,
    cHigh,
    iLow: INDEX_HIGHS[band - 1] ?? 0,
    iHigh: INDEX_HIGHS[band] ?? 0,
  }));
}

/** Sub-index for one averaged concentration (in the pollutant's CPCB unit); null for invalid values. */
export function subIndex(pollutant: NaqiPollutant, concentration: number): SubIndex | null {
  if (!Number.isFinite(concentration) || concentration < 0) return null;
  const rule = NAQI_RULES[pollutant];
  const base = { pollutant, label: rule.label, concentration };
  const segment = segments(rule.highs).find((seg) => concentration <= seg.cHigh);
  if (!segment) return { ...base, index: 401, aboveScale: true };
  const { cLow, cHigh, iLow, iHigh } = segment;
  const index = Math.round(iLow + ((concentration - cLow) * (iHigh - iLow)) / (cHigh - cLow));
  return { ...base, index, aboveScale: false };
}

/** Category for an overall index value. */
export function naqiCategory(index: number): CategoryInfo {
  const band = INDEX_HIGHS.findIndex((high) => index <= high);
  return BOUNDED_CATEGORIES[band] ?? SEVERE;
}

/** Mean of the hourly values, or null when fewer than `MIN_HOURS_24H` hours have data. */
export function average24h(hourly: readonly (number | null)[]): number | null {
  const values = hourly.filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length < MIN_HOURS_24H) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Highest 8-hour running average over consecutive hourly values (oldest first); windows with fewer
 * than `MIN_HOURS_8H` values are skipped. Null when no window qualifies.
 */
export function max8hAverage(hourly: readonly (number | null)[]): number | null {
  let best: number | null = null;
  for (let start = 0; start + 8 <= hourly.length; start++) {
    const window = hourly
      .slice(start, start + 8)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (window.length < MIN_HOURS_8H) continue;
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
    if (best === null || avg > best) best = avg;
  }
  return best;
}

/**
 * Why a set of pollutants cannot give an index (CPCB: at least three, including PM2.5 or PM10), or null
 * when they can.
 */
export function missingRequirement(pollutants: readonly NaqiPollutant[]): string | null {
  if (!pollutants.includes("pm2_5") && !pollutants.includes("pm10")) {
    return "Needs at least 16 hours of PM2.5 or PM10 data in the last 24 hours.";
  }
  if (pollutants.length < MIN_POLLUTANTS) {
    return `Needs at least ${MIN_POLLUTANTS} pollutants with enough data; this station has ${pollutants.length}.`;
  }
  return null;
}

/**
 * The National AQI from hourly series (oldest first, last 24 hours, in each pollutant's CPCB unit).
 * Pollutants without enough data are left out; the result says why when no index can be given.
 */
export function computeNaqi(hourly: Partial<Record<NaqiPollutant, readonly (number | null)[]>>): NaqiResult {
  const subIndices = NAQI_POLLUTANTS.flatMap((key) => {
    const series = hourly[key];
    if (!series) return [];
    const averaged = NAQI_RULES[key].averaging === "24h" ? average24h(series) : max8hAverage(series);
    const sub = averaged === null ? null : subIndex(key, averaged);
    return sub ? [sub] : [];
  }).sort((a, b) => b.index - a.index);
  const reason = missingRequirement(subIndices.map((s) => s.pollutant));
  if (reason) return { ok: false, reason, subIndices };
  const [prominent] = subIndices;
  if (!prominent) return { ok: false, reason: "No pollutant has enough data.", subIndices };
  return {
    ok: true,
    index: prominent.index,
    aboveScale: prominent.aboveScale,
    ...naqiCategory(prominent.index),
    prominent,
    subIndices,
  };
}
