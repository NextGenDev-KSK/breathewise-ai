import type { AirQualitySnapshot, HourlyPoint } from "@/types/air";
import { AIR_MODELS } from "@/lib/air/models";
import { epochToLocalTime } from "@/lib/time";

/**
 * SAMPLE DATA for demo mode. Values follow a fixed, plausible winter pattern for a large
 * North-Indian city (morning and late-evening peaks, cleaner afternoon). They are NOT
 * real measurements or forecasts and are always labelled as sample data in the UI.
 */
export const DEMO_PLACE = {
  id: "demo-sample-city",
  name: "Sample City",
  admin1: "Demo data",
  country: "India (sample)",
  countryCode: "IN",
  latitude: 28.61,
  longitude: 77.21,
  source: "demo" as const,
};

const OFFSET = 19_800; // UTC+05:30

/** PM2.5 (µg/m³) by local hour of day. */
const PM25_BY_HOUR = [118, 124, 128, 131, 133, 135, 132, 124, 108, 88, 70, 58, 50, 46, 44, 47, 56, 72, 92, 108, 116, 120, 121, 120];

/** Simplified US AQI from PM2.5 using EPA 2024 breakpoints (for the sample only). */
export function samplePm25ToUsAqi(pm: number): number {
  const bp: [number, number, number, number][] = [
    [0, 9, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 325.4, 301, 500],
  ];
  const row = bp.find(([lo, hi]) => pm >= lo && pm <= hi) ?? bp[bp.length - 1]!;
  const [cLo, cHi, iLo, iHi] = row;
  return Math.round(((iHi - iLo) / (cHi - cLo)) * (Math.min(pm, cHi) - cLo) + iLo);
}

export function buildDemoSnapshot(nowMs: number): AirQualitySnapshot {
  const hourMs = 3_600_000;
  const localNow = epochToLocalTime(nowMs, OFFSET);
  const startOfLocalDay = nowMs - (Number(localNow.slice(11, 13)) * 60 + Number(localNow.slice(14, 16))) * 60_000;
  const hourly: HourlyPoint[] = [];
  for (let i = 0; i < 72; i++) {
    const epochMs = startOfLocalDay + i * hourMs;
    const hour = i % 24;
    const dayFactor = 1 - Math.floor(i / 24) * 0.12; // gradual improvement over the sample days
    const pm = Math.round((PM25_BY_HOUR[hour] as number) * dayFactor * 10) / 10;
    hourly.push({
      time: epochToLocalTime(epochMs, OFFSET),
      epochMs,
      pm2_5: pm,
      pm10: Math.round(pm * 1.7),
      nitrogen_dioxide: Math.round(30 + (hour >= 8 && hour <= 11 ? 25 : hour >= 18 && hour <= 21 ? 30 : 0)),
      ozone: Math.round(20 + (hour >= 12 && hour <= 16 ? 55 : 10)),
      us_aqi: samplePm25ToUsAqi(pm),
      european_aqi: Math.min(140, Math.round(pm * 0.9)),
    });
  }
  const currentEpoch = nowMs - (nowMs - startOfLocalDay) % hourMs;
  const cur = hourly.find((h) => h.epochMs === currentEpoch) ?? (hourly[0] as HourlyPoint);
  const pm25 = cur.pm2_5 as number;
  return {
    place: { ...DEMO_PLACE },
    timezone: "Asia/Kolkata",
    timezoneAbbreviation: "IST",
    utcOffsetSeconds: OFFSET,
    current: {
      time: cur.time,
      epochMs: cur.epochMs,
      pollutants: {
        pm2_5: pm25,
        pm10: cur.pm10,
        nitrogen_dioxide: cur.nitrogen_dioxide,
        sulphur_dioxide: 14,
        carbon_monoxide: 1450,
        ozone: cur.ozone,
        dust: 22,
        ammonia: null,
      },
      usAqi: cur.us_aqi,
      europeanAqi: cur.european_aqi,
      usSubIndices: {
        pm2_5: cur.us_aqi,
        pm10: Math.round((cur.us_aqi as number) * 0.55),
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
