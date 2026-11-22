import type { Page } from "@playwright/test";
import delhi from "../fixtures/open-meteo-delhi.json" with { type: "json" };
import stations from "../../lib/demo/stations-sample.json" with { type: "json" };

/** 2026-11-17 22:35 IST: just after the captured Delhi reading, so the forecast is "upcoming". */
const FIXTURE_NOW = new Date("2026-11-17T17:05:00Z");

const DELHI_PLACE = {
  id: "geo-1273294",
  name: "Delhi",
  admin1: "Delhi",
  country: "India",
  countryCode: "IN",
  latitude: 28.652,
  longitude: 77.2315,
  source: "search",
};

const GEOCODE = {
  results: [
    {
      id: 1273294,
      name: "Delhi",
      latitude: 28.652,
      longitude: 77.2315,
      country: "India",
      country_code: "IN",
      admin1: "Delhi",
    },
  ],
};

export interface MockOptions {
  airStatus?: number;
  /** HTTP status for /api/stations; 200 (default) answers with the captured Delhi station report. */
  stationsStatus?: number;
}

/** Mocks Open-Meteo, pins the clock, and optionally seeds local storage. */
export async function setup(
  page: Page,
  opts: { seedPlace?: boolean; onboarded?: boolean; settings?: Record<string, unknown> } & MockOptions = {},
) {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.route("https://air-quality-api.open-meteo.com/**", (route) =>
    opts.airStatus && opts.airStatus !== 200
      ? route.fulfill({
          status: opts.airStatus,
          contentType: "application/json",
          body: JSON.stringify({ error: true }),
        })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(delhi) }),
  );
  // Station data needs a server-side OpenAQ key, so end-to-end runs answer with a real captured report.
  await page.route("**/api/stations?**", (route) =>
    opts.stationsStatus && opts.stationsStatus !== 200
      ? route.fulfill({
          status: opts.stationsStatus,
          json: {
            error: "stations_unavailable",
            message: "Monitoring-station data is temporarily unavailable.",
          },
        })
      : route.fulfill({ status: 200, json: stations }),
  );
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(GEOCODE) }),
  );
  const settings = {
    aqiStandard: "us",
    timeFormat: "24h",
    aiEnabled: true,
    demoMode: false,
    onboarded: opts.onboarded ?? true,
    ...opts.settings,
  };
  await page.addInitScript(
    ([place, s, seed]) => {
      if (sessionStorage.getItem("seeded")) return; // seed once, so reload tests see persisted state
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("breathewise:v1:settings", JSON.stringify(s));
      if (seed) localStorage.setItem("breathewise:v1:place", JSON.stringify(place));
    },
    [DELHI_PLACE, settings, opts.seedPlace ?? true] as const,
  );
}
