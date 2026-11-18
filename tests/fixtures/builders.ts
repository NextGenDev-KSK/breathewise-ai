import type { AirQualitySnapshot, HourlyPoint, Place } from "@/types/air";
import { DEFAULT_PREFERENCES, type Preferences } from "@/types/preferences";
import { AIR_MODELS } from "@/lib/air/models";
import { epochToLocalTime, localTimeToEpoch } from "@/lib/time";
import delhiRaw from "./open-meteo-delhi.json";

const IST = 19_800;
export { delhiRaw };

/** "Now" for the captured Delhi fixture: 2026-11-17 22:30 IST. */
export const DELHI_NOW = localTimeToEpoch("2026-11-17T22:30", IST);

export const DELHI: Place = {
  id: "geo-1273294",
  name: "Delhi",
  admin1: "Delhi",
  country: "India",
  countryCode: "IN",
  latitude: 28.652,
  longitude: 77.2315,
  source: "search",
};

export const BERLIN: Place = {
  id: "geo-2950159",
  name: "Berlin",
  country: "Germany",
  countryCode: "DE",
  latitude: 52.52,
  longitude: 13.41,
  source: "search",
};

export interface SyntheticOptions {
  /** Local start time of the hourly series, e.g. "2026-11-17T00:00". */
  start?: string;
  /** PM2.5 per hour; null = missing. US AQI is derived roughly as 2×PM2.5 unless given. */
  pm25: (number | null)[];
  usAqi?: (number | null)[];
  nowLocal?: string;
  place?: Place;
  model?: "cams_global" | "cams_europe";
  origin?: AirQualitySnapshot["origin"];
}

/** Builds a deterministic snapshot for engine tests. */
export function makeSnapshot(opts: SyntheticOptions): { snapshot: AirQualitySnapshot; nowMs: number } {
  const start = opts.start ?? "2026-11-17T00:00";
  const startMs = localTimeToEpoch(start, IST);
  const hourly: HourlyPoint[] = opts.pm25.map((pm, i) => {
    const epochMs = startMs + i * 3_600_000;
    const us = opts.usAqi ? (opts.usAqi[i] ?? null) : pm === null ? null : Math.round(pm * 2);
    return {
      time: epochToLocalTime(epochMs, IST),
      epochMs,
      pm2_5: pm,
      pm10: pm === null ? null : pm * 1.5,
      nitrogen_dioxide: 20,
      ozone: 30,
      us_aqi: us,
      european_aqi: pm === null ? null : Math.round(pm * 0.9),
    };
  });
  const nowLocal = opts.nowLocal ?? start;
  const nowMs = localTimeToEpoch(nowLocal, IST);
  const cur = hourly.find((h) => h.epochMs === nowMs) ?? hourly[0]!;
  const snapshot: AirQualitySnapshot = {
    place: opts.place ?? DELHI,
    timezone: "Asia/Kolkata",
    timezoneAbbreviation: "IST",
    utcOffsetSeconds: IST,
    current: {
      time: cur.time,
      epochMs: cur.epochMs,
      pollutants: {
        pm2_5: cur.pm2_5,
        pm10: cur.pm10,
        nitrogen_dioxide: 20,
        sulphur_dioxide: 5,
        carbon_monoxide: 400,
        ozone: 30,
        dust: 2,
        ammonia: null,
      },
      usAqi: cur.us_aqi,
      europeanAqi: cur.european_aqi,
      usSubIndices: {
        pm2_5: cur.us_aqi,
        pm10: 30,
        nitrogen_dioxide: 20,
        sulphur_dioxide: 5,
        carbon_monoxide: 5,
        ozone: 25,
      },
    },
    hourly,
    model: AIR_MODELS[opts.model ?? "cams_global"],
    fetchedAt: nowMs,
    origin: opts.origin ?? "live",
  };
  return { snapshot, nowMs };
}

/** PM2.5 by local hour: polluted night/morning, cleanest early afternoon (min 22 at 14:00), rising evening. */
const DAY = [
  120, 125, 130, 130, 128, 125, 118, 110, 95, 75, 55, 40, 30, 25, 22, 24, 35, 55, 75, 90, 100, 108, 112, 118,
];
export const DIURNAL = [...DAY, ...DAY];

export function prefs(patch: Partial<Preferences> = {}): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...patch,
    household: { ...DEFAULT_PREFERENCES.household, ...patch.household },
    equipment: { ...DEFAULT_PREFERENCES.equipment, ...patch.equipment },
  };
}
