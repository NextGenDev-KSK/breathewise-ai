import type { AirQualitySnapshot, Place } from "@/types/air";
import { AIR_MODELS } from "@/lib/air/models";
import { epochToLocalTime, HOUR_MS, MINUTE_MS } from "@/lib/time";

/**
 * SAMPLE DATA for demo mode. Values follow a fixed, plausible winter pattern for a large
 * North-Indian city (morning and late-evening peaks, cleaner afternoon). They are NOT
 * real measurements or forecasts and are always labelled as sample data in the UI.
 */
const DEMO_PLACE: Place = {
  id: "demo-sample-city",
  name: "Sample City",
  admin1: "Demo data",
  country: "India (sample)",
  countryCode: "IN",
  latitude: 28.61,
  longitude: 77.21,
  source: "demo",
};

const OFFSET_SECONDS = 19_800; // UTC+05:30
const SAMPLE_DAYS = 3;
/** Each later sample day is this much cleaner, to show an improving trend. */
const DAILY_IMPROVEMENT = 0.12;

/** PM2.5 (µg/m³) by local hour of day. */
const PM25_BY_HOUR = [
  118, 124, 128, 131, 133, 135, 132, 124, 108, 88, 70, 58, 50, 46, 44, 47, 56, 72, 92, 108, 116, 120, 121,
  120,
] as const;

type Breakpoint = readonly [
  concentrationLow: number,
  concentrationHigh: number,
  indexLow: number,
  indexHigh: number,
];

const TOP_BREAKPOINT: Breakpoint = [225.5, 325.4, 301, 500];
/** US EPA 2024 PM2.5 breakpoints, used only to give the sample a consistent US AQI. */
const BREAKPOINTS: readonly Breakpoint[] = [
  [0, 9, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  TOP_BREAKPOINT,
];

function samplePm25ToUsAqi(pm: number): number {
  const [cLo, cHi, iLo, iHi] = BREAKPOINTS.find(([lo, hi]) => pm >= lo && pm <= hi) ?? TOP_BREAKPOINT;
  return Math.round(((iHi - iLo) / (cHi - cLo)) * (Math.min(pm, cHi) - cLo) + iLo);
}

/** The sample reading for hour `index` after local midnight on the first sample day. */
function sampleHour(index: number, startOfLocalDay: number) {
  const hourOfDay = index % 24;
  const dayFactor = 1 - Math.floor(index / 24) * DAILY_IMPROVEMENT;
  const pm = Math.round((PM25_BY_HOUR[hourOfDay] ?? PM25_BY_HOUR[0]) * dayFactor * 10) / 10;
  const usAqi = samplePm25ToUsAqi(pm);
  const epochMs = startOfLocalDay + index * HOUR_MS;
  const rushHourNo2 = hourOfDay >= 8 && hourOfDay <= 11 ? 25 : hourOfDay >= 18 && hourOfDay <= 21 ? 30 : 0;
  return {
    time: epochToLocalTime(epochMs, OFFSET_SECONDS),
    epochMs,
    pm2_5: pm,
    pm10: Math.round(pm * 1.7),
    nitrogen_dioxide: 30 + rushHourNo2,
    ozone: hourOfDay >= 12 && hourOfDay <= 16 ? 75 : 30,
    us_aqi: usAqi,
    european_aqi: Math.min(140, Math.round(pm * 0.9)),
  };
}

/** Builds a labelled sample snapshot whose forecast always starts at the current hour. */
export function buildDemoSnapshot(nowMs: number): AirQualitySnapshot {
  const localNow = epochToLocalTime(nowMs, OFFSET_SECONDS);
  const minutesSinceMidnight = Number(localNow.slice(11, 13)) * 60 + Number(localNow.slice(14, 16));
  const startOfLocalDay = nowMs - minutesSinceMidnight * MINUTE_MS;
  const hourly = Array.from({ length: SAMPLE_DAYS * 24 }, (_, index) => sampleHour(index, startOfLocalDay));
  const current = sampleHour(Math.floor(minutesSinceMidnight / 60), startOfLocalDay);

  return {
    place: { ...DEMO_PLACE },
    timezone: "Asia/Kolkata",
    timezoneAbbreviation: "IST",
    utcOffsetSeconds: OFFSET_SECONDS,
    current: {
      time: current.time,
      epochMs: current.epochMs,
      pollutants: {
        pm2_5: current.pm2_5,
        pm10: current.pm10,
        nitrogen_dioxide: current.nitrogen_dioxide,
        sulphur_dioxide: 14,
        carbon_monoxide: 1450,
        ozone: current.ozone,
        dust: 22,
        ammonia: null,
      },
      usAqi: current.us_aqi,
      europeanAqi: current.european_aqi,
      usSubIndices: {
        pm2_5: current.us_aqi,
        pm10: Math.round(current.us_aqi * 0.55),
        nitrogen_dioxide: 30,
        sulphur_dioxide: 12,
        carbon_monoxide: 14,
        ozone: 25,
      },
    },
    hourly,
    model: AIR_MODELS.sample,
    fetchedAt: nowMs,
    origin: "demo",
  };
}
