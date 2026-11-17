import type { HourlyPoint } from "@/types/air";
import { assessConcern, type ConcernLevel } from "@/lib/air/indices";
import { pm25Band } from "@/lib/air/indices";

export type SeriesMetric = "pm2_5" | "pm10" | "us_aqi" | "european_aqi";

export const SERIES_META: Record<SeriesMetric, { label: string; unit: string }> = {
  pm2_5: { label: "PM2.5", unit: "µg/m³" },
  pm10: { label: "PM10", unit: "µg/m³" },
  us_aqi: { label: "US AQI", unit: "" },
  european_aqi: { label: "European AQI", unit: "" },
};

/** PM10 bands (µg/m³, US EPA 24-hour breakpoints), for colouring only. */
function pm10Level(v: number): ConcernLevel {
  if (v <= 54) return 0;
  if (v <= 154) return 1;
  if (v <= 254) return 2;
  if (v <= 354) return 3;
  if (v <= 424) return 4;
  return 5;
}

export function levelFor(metric: SeriesMetric, value: number | null): ConcernLevel | null {
  if (value === null) return null;
  switch (metric) {
    case "pm2_5":
      return pm25Band(value)?.level ?? null;
    case "pm10":
      return pm10Level(value);
    case "us_aqi":
      return assessConcern({ us_aqi: value, european_aqi: null, pm2_5: null })?.level ?? null;
    case "european_aqi":
      return assessConcern({ us_aqi: null, european_aqi: value, pm2_5: null })?.level ?? null;
  }
}

export function buildSeries(hours: HourlyPoint[], metric: SeriesMetric) {
  return hours.map((h) => ({ time: h.time, value: h[metric], level: levelFor(metric, h[metric]) }));
}

export interface DaySummary {
  date: string;
  firstTime: string;
  hours: number;
  pm25: { min: number; mean: number; max: number } | null;
  usAqiMax: number | null;
  europeanAqiMax: number | null;
}

/** Per-day min/mean/max summary of the forecast (local dates). Missing values are skipped, not zeroed. */
export function summarizeDays(hours: HourlyPoint[]): DaySummary[] {
  const byDate = new Map<string, HourlyPoint[]>();
  for (const h of hours) {
    const d = h.time.slice(0, 10);
    const list = byDate.get(d) ?? [];
    list.push(h);
    byDate.set(d, list);
  }
  return [...byDate.entries()].map(([date, list]) => {
    const pm = list.map((h) => h.pm2_5).filter((v): v is number => v !== null);
    const us = list.map((h) => h.us_aqi).filter((v): v is number => v !== null);
    const eu = list.map((h) => h.european_aqi).filter((v): v is number => v !== null);
    return {
      date,
      firstTime: (list[0] as HourlyPoint).time,
      hours: list.length,
      pm25: pm.length ? { min: Math.min(...pm), mean: pm.reduce((a, b) => a + b, 0) / pm.length, max: Math.max(...pm) } : null,
      usAqiMax: us.length ? Math.max(...us) : null,
      europeanAqiMax: eu.length ? Math.max(...eu) : null,
    };
  });
}
