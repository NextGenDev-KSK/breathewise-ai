import { describe, expect, it, vi } from "vitest";
import { fetchStationReport, OpenAqError, readOpenAqKey } from "@/lib/stations/openaq";
import { StationReportSchema } from "@/lib/stations/schema";
import { jsonResponse } from "@/tests/fixtures/http";
import locationsDelhi from "@/tests/fixtures/openaq-locations-delhi.json";
import latestRkPuram from "@/tests/fixtures/openaq-latest-rkpuram.json";
import hoursPm25RkPuram from "@/tests/fixtures/openaq-hours-pm25-rkpuram.json";

/** Half an hour after R K Puram's latest captured reading (03:30 UTC on 22 Nov 2026). */
const NOW = Date.parse("2026-11-22T04:00:00Z");
const HOUR = 3_600_000;

/** 24 hourly values ending with the hour 02:30–03:30 UTC, in OpenAQ's `/hours` shape. */
function hours(value: number | ((i: number) => number | null), count = 24) {
  const lastFrom = Date.parse("2026-11-22T02:30:00Z");
  return {
    results: Array.from({ length: count }, (_, i) => ({
      value: typeof value === "number" ? value : value(i),
      period: { datetimeFrom: { utc: new Date(lastFrom - (count - 1 - i) * HOUR).toISOString() } },
    })),
  };
}

/** A canned JSON body, or a function producing the response (for errors). */
type Routes = Record<string, object | (() => Response)>;

/** A fetch stub that answers by path prefix (query string ignored) and records every URL. */
function openAq(routes: Routes) {
  const calls: { url: string; key: string | null }[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, key: new Headers(init?.headers).get("x-api-key") });
    const path = new URL(url).pathname.replace("/v3", "");
    const route = routes[path];
    if (route === undefined) return jsonResponse({ results: [] });
    return typeof route === "function" ? route() : jsonResponse(route);
  });
  return { fetchImpl, calls };
}

const delhiRoutes: Routes = {
  "/locations": locationsDelhi,
  "/locations/17/latest": latestRkPuram,
  "/sensors/12234787/hours": hoursPm25RkPuram, // PM2.5 (real capture)
  "/sensors/12234786/hours": hours(180), // PM10
  "/sensors/12234785/hours": hours(20), // O3
};

const report = (routes: Routes, nowMs = NOW) => {
  const stub = openAq(routes);
  return {
    stub,
    result: fetchStationReport(28.61, 77.21, { key: "test-key", nowMs, fetchImpl: stub.fetchImpl }),
  };
};

describe("fetchStationReport (real captured OpenAQ responses for Delhi)", () => {
  it("lists active reference monitors nearest first, skipping stations silent since 2018", async () => {
    const { result } = report(delhiRoutes);
    const { stations } = await result;
    expect(stations.map((s) => s.name)).toEqual([
      "R K Puram, Delhi - DPCC",
      "Punjabi Bagh, Delhi - DPCC",
      "Anand Vihar, New Delhi - DPCC",
    ]);
    expect(stations[0]).toMatchObject({ provider: "CPCB", countryCode: "IN", distanceKm: 6 });
  });

  it("uses the newest µg/m³ stream per pollutant and skips streams labelled ppb", async () => {
    const { nearest } = await report(delhiRoutes).result;
    expect(nearest?.station.name).toBe("R K Puram, Delhi - DPCC");
    expect(nearest?.readings).toEqual(
      expect.arrayContaining([
        { pollutant: "pm2_5", value: 140, unit: "µg/m³", measuredAt: "2026-11-22T03:30:00Z" },
        { pollutant: "pm10", value: 186, unit: "µg/m³", measuredAt: "2026-11-22T03:30:00Z" },
        { pollutant: "ozone", value: 6.9, unit: "µg/m³", measuredAt: "2026-11-22T03:30:00Z" },
      ]),
    );
    // NO2, SO2 and CO are only current in ppb-labelled streams, and the µg/m³ ones stopped in 2018.
    expect(nearest?.readings.map((r) => r.pollutant).sort()).toEqual(["ozone", "pm10", "pm2_5"]);
  });

  it("computes the CPCB National AQI from the last 24 hours (23 of 24 hours of real PM2.5 data)", async () => {
    const { nearest } = await report(delhiRoutes).result;
    expect(nearest?.naqi).toMatchObject({
      ok: true,
      index: 281, // PM2.5 average 114.35 µg/m³: 200 + (114.35 − 90) × 100 / 30
      category: "Poor",
      prominent: { pollutant: "pm2_5" },
    });
    if (nearest?.naqi?.ok) {
      expect(nearest.naqi.subIndices.map((s) => [s.pollutant, s.index])).toEqual([
        ["pm2_5", 281],
        ["pm10", 153], // 100 + (180 − 100) × 100 / 150
        ["ozone", 20],
      ]);
    }
  });

  it("produces a report that passes the public API schema", async () => {
    expect(StationReportSchema.safeParse(await report(delhiRoutes).result).success).toBe(true);
  });

  it("asks only for monitors within 25 km and sends the key as a header, never in the URL", async () => {
    const { stub, result } = report(delhiRoutes);
    await result;
    const [first] = stub.calls;
    expect(first?.url).toContain("/v3/locations?coordinates=28.61,77.21&radius=25000&monitor=true");
    expect(stub.calls.every((c) => c.key === "test-key" && !c.url.includes("test-key"))).toBe(true);
  });

  it("reports no stations when none has reported in the last 3 hours", async () => {
    const result = await report(delhiRoutes, NOW + 4 * HOUR).result;
    expect(result).toMatchObject({ stations: [], nearest: null });
  });
});

describe("fetchStationReport (choosing the station for the index)", () => {
  const location = (id: number, km: number, sensors: [number, string, string][], country = "IN") => ({
    id,
    name: `Station ${id}`,
    country: { code: country },
    provider: { name: "CPCB" },
    isMobile: false,
    isMonitor: true,
    distance: km * 1000,
    datetimeLast: { utc: "2026-11-22T03:30:00Z" },
    sensors: sensors.map(([sid, name, units]) => ({ id: sid, parameter: { name, units } })),
  });
  const latest = (...values: [number, number][]) => ({
    results: values.map(([sensorsId, value]) => ({
      sensorsId,
      value,
      datetime: { utc: "2026-11-22T03:30:00Z" },
    })),
  });

  it("moves to the next station when the nearest cannot give an index, without downloading its history", async () => {
    const { stub, result } = report({
      "/locations": {
        results: [
          location(1, 0.8, [[11, "pm25", "µg/m³"]]),
          location(2, 2.4, [
            [21, "pm25", "µg/m³"],
            [22, "pm10", "µg/m³"],
            [23, "o3", "µg/m³"],
          ]),
        ],
      },
      "/locations/1/latest": latest([11, 139]),
      "/locations/2/latest": latest([21, 74], [22, 160], [23, 22]),
      "/sensors/21/hours": hours(60),
      "/sensors/22/hours": hours(160),
      "/sensors/23/hours": hours(20),
    });
    const { stations, nearest } = await result;
    expect(stations.map((s) => s.id)).toEqual([1, 2]);
    expect(nearest?.station.id).toBe(2);
    expect(nearest?.naqi).toMatchObject({ ok: true, index: 140, prominent: { pollutant: "pm10" } });
    expect(stub.calls.some((c) => c.url.includes("/sensors/11/"))).toBe(false);
  });

  it("explains why no index is possible when no nearby station qualifies", async () => {
    const { nearest } = await report({
      "/locations": { results: [location(1, 0.8, [[11, "pm25", "µg/m³"]])] },
      "/locations/1/latest": latest([11, 139]),
    }).result;
    expect(nearest).toMatchObject({
      station: { id: 1 },
      naqi: { ok: false, reason: expect.stringMatching(/this station has 1/) },
    });
  });

  it("applies the 16-hour rule to station history", async () => {
    const sparse = (value: number) => hours((i) => (i % 2 === 0 ? value : null));
    const { nearest } = await report({
      "/locations": {
        results: [
          location(2, 1, [
            [21, "pm25", "µg/m³"],
            [22, "pm10", "µg/m³"],
            [23, "o3", "µg/m³"],
          ]),
        ],
      },
      "/locations/2/latest": latest([21, 74], [22, 160], [23, 22]),
      "/sensors/21/hours": sparse(60),
      "/sensors/22/hours": sparse(160),
      "/sensors/23/hours": hours(20),
    }).result;
    expect(nearest?.naqi).toMatchObject({ ok: false, reason: expect.stringMatching(/PM2.5 or PM10/) });
  });

  it("gives readings but no CPCB index outside India, and converts CO to mg/m³", async () => {
    const { nearest } = await report({
      "/locations": { results: [location(5, 3, [[51, "co", "µg/m³"]], "DE")] },
      "/locations/5/latest": latest([51, 450]),
    }).result;
    expect(nearest).toMatchObject({
      naqi: null,
      readings: [{ pollutant: "carbon_monoxide", value: 0.45, unit: "mg/m³" }],
    });
  });

  it("skips mobile units, low-cost sensors and malformed entries", async () => {
    const { stations } = await report({
      "/locations": {
        results: [
          { ...location(1, 1, []), isMobile: true },
          { ...location(2, 1, []), isMonitor: false },
          { id: "broken" },
          location(3, 5, []),
        ],
      },
    }).result;
    expect(stations.map((s) => s.id)).toEqual([3]);
  });
});

describe("fetchStationReport errors", () => {
  const failWith = (route: () => Response) => report({ "/locations": route }).result;

  it.each([
    ["rate-limited", () => new Response("", { status: 429 })],
    ["unavailable", () => new Response("", { status: 500 })],
    ["unavailable", () => new Response("<html>", { status: 200 })],
  ] as const)("maps upstream responses to %s", async (kind, route) => {
    await expect(failWith(route)).rejects.toMatchObject({ kind });
  });

  it("maps network failures and timeouts", async () => {
    await expect(
      failWith(() => {
        throw new TypeError("offline");
      }),
    ).rejects.toBeInstanceOf(OpenAqError);
    await expect(
      failWith(() => {
        throw new DOMException("too slow", "TimeoutError");
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("readOpenAqKey", () => {
  it("is null when the key is missing or blank", () => {
    expect(readOpenAqKey({ OPENAQ_API_KEY: "  " })).toBeNull();
    expect(readOpenAqKey({})).toBeNull();
    expect(readOpenAqKey({ OPENAQ_API_KEY: " abc " })).toBe("abc");
  });
});
