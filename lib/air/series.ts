import type { HourlyPoint } from "@/types/air";
import { concernLevelFor, type ConcernLevel } from "@/lib/air/indices";
import { mean, presentValues } from "@/lib/math";

export type SeriesMetric = "pm2_5" | "pm10" | "us_aqi" | "european_aqi";

export const SERIES_META: Record<SeriesMetric, { label: string; unit: string }> = {
  pm2_5: { label: "PM2.5", unit: "µg/m³" },
  pm10: { label: "PM10", unit: "µg/m³" },
  us_aqi: { label: "US AQI", unit: "" },
  european_aqi: { label: "European AQI", unit: "" },
};

export interface SeriesPoint {
  time: string;
  value: number | null;
  level: ConcernLevel | null;
}

/** One chart point per hour; missing values stay null and get no concern level. */
export function buildSeries(hours: readonly HourlyPoint[], metric: SeriesMetric): SeriesPoint[] {
  return hours.map((hour) => ({
    time: hour.time,
    value: hour[metric],
    level: concernLevelFor(metric, hour[metric]),
  }));
}

export interface DaySummary {
  date: string;
  firstTime: string;
  hours: number;
  pm25: { min: number; mean: number; max: number } | null;
  usAqiMax: number | null;
  europeanAqiMax: number | null;
}

function maxOrNull(values: readonly number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

/** Per-day min/mean/max summary of the forecast (local dates). Missing values are skipped, not zeroed. */
export function summarizeDays(hours: readonly HourlyPoint[]): DaySummary[] {
  const byDate = new Map<string, HourlyPoint[]>();
  for (const hour of hours) {
    const date = hour.time.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), hour]);
  }
  return [...byDate.entries()].flatMap(([date, list]) => {
    const [first] = list;
    if (!first) return [];
    const pm = presentValues(list.map((h) => h.pm2_5));
    const pmMean = mean(pm);
    return [
      {
        date,
        firstTime: first.time,
        hours: list.length,
        pm25: pmMean === null ? null : { min: Math.min(...pm), mean: pmMean, max: Math.max(...pm) },
        usAqiMax: maxOrNull(presentValues(list.map((h) => h.us_aqi))),
        europeanAqiMax: maxOrNull(presentValues(list.map((h) => h.european_aqi))),
      },
    ];
  });
}
