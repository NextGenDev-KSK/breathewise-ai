import { describe, expect, it, vi } from "vitest";
import {
  AirQualityError,
  buildAirQualityUrl,
  fetchAirQuality,
  isEmptySnapshot,
  normalizeAirQuality,
} from "@/lib/air/openMeteo";
import { selectModelForLocation } from "@/lib/air/models";
import { BERLIN, DELHI, DELHI_NOW, delhiRaw } from "../fixtures/builders";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("buildAirQualityUrl", () => {
  it("requests only the needed variables with automatic timezone and an explicit domain", () => {
    const url = new URL(buildAirQualityUrl(DELHI));
    expect(url.origin + url.pathname).toBe("https://air-quality-api.open-meteo.com/v1/air-quality");
    expect(url.searchParams.get("timezone")).toBe("auto");
    expect(url.searchParams.get("domains")).toBe("cams_global");
    expect(url.searchParams.get("forecast_days")).toBe("4");
    expect(url.searchParams.get("current")?.split(",")).toEqual(
      expect.arrayContaining(["pm2_5", "us_aqi", "us_aqi_pm2_5", "european_aqi"]),
    );
    expect(url.searchParams.get("hourly")).toBe("pm2_5,pm10,nitrogen_dioxide,ozone,us_aqi,european_aqi");
  });

  it("uses the higher-resolution European model inside Europe", () => {
    expect(selectModelForLocation(BERLIN.latitude, BERLIN.longitude)).toBe("cams_europe");
    expect(selectModelForLocation(DELHI.latitude, DELHI.longitude)).toBe("cams_global");
    expect(new URL(buildAirQualityUrl(BERLIN)).searchParams.get("domains")).toBe("cams_europe");
  });
});

describe("normalizeAirQuality (real captured Delhi response)", () => {
  const s = normalizeAirQuality(delhiRaw, DELHI, "cams_global", DELHI_NOW);

  it("keeps readings, timezone and model metadata", () => {
    expect(s.current.pollutants.pm2_5).toBe(86.6);
    expect(s.current.usAqi).toBe(152);
    expect(s.current.usSubIndices.pm2_5).toBe(152);
    expect(s.utcOffsetSeconds).toBe(19_800);
    expect(s.current.epochMs).toBe(DELHI_NOW);
    expect(s.model.id).toBe("cams_global");
    expect(s.origin).toBe("live");
    expect(s.hourly).toHaveLength(96);
  });

  it("keeps unavailable pollutants as null rather than zero", () => {
    expect(s.current.pollutants.ammonia).toBeNull();
  });

  it("computes absolute instants from local times", () => {
    expect(new Date(s.hourly[0]!.epochMs).toISOString()).toBe("2026-11-16T18:30:00.000Z");
  });
});

describe("normalizeAirQuality edge cases", () => {
  const base = delhiRaw as unknown as Record<string, unknown>;

  it("rejects structurally invalid payloads", () => {
    expect(() => normalizeAirQuality({ hello: "world" }, DELHI, "cams_global", 0)).toThrow(AirQualityError);
    expect(() => normalizeAirQuality(null, DELHI, "cams_global", 0)).toThrow(/unexpected format/);
  });

  it("rejects malformed timestamps", () => {
    const bad = { ...base, current: { ...(base.current as object), time: "yesterday" } };
    expect(() => normalizeAirQuality(bad, DELHI, "cams_global", 0)).toThrow(/timestamp/);
  });

  it("turns null, negative and non-numeric values into null", () => {
    const hourly = base.hourly as Record<string, unknown[]>;
    const raw = {
      ...base,
      current: { ...(base.current as object), pm2_5: null, pm10: -5, us_aqi: "high" },
      hourly: { ...hourly, pm2_5: hourly.pm2_5!.map((v, i) => (i === 0 ? null : v)) },
    };
    const s = normalizeAirQuality(raw, DELHI, "cams_global", 0);
    expect(s.current.pollutants.pm2_5).toBeNull();
    expect(s.current.pollutants.pm10).toBeNull();
    expect(s.current.usAqi).toBeNull();
    expect(s.hourly[0]!.pm2_5).toBeNull();
  });

  it("handles a response with missing hourly variables", () => {
    const raw = { ...base, hourly: { time: ["2026-11-17T00:00"] } };
    const s = normalizeAirQuality(raw, DELHI, "cams_global", 0);
    expect(s.hourly[0]).toMatchObject({ pm2_5: null, us_aqi: null });
  });
});

describe("fetchAirQuality", () => {
  it("returns a normalized snapshot from a mocked API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(delhiRaw));
    const s = await fetchAirQuality(DELHI, { fetchImpl, now: () => 123 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(s.fetchedAt).toBe(123);
    expect(s.place).toBe(DELHI);
  });

  it("reports rate limiting distinctly", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ reason: "limit" }, 429));
    await expect(fetchAirQuality(DELHI, { fetchImpl })).rejects.toMatchObject({ kind: "rate-limited" });
  });

  it("reports HTTP errors and network failures", async () => {
    await expect(
      fetchAirQuality(DELHI, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse({}, 500)) }),
    ).rejects.toMatchObject({ kind: "http" });
    await expect(
      fetchAirQuality(DELHI, { fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) }),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("reports unreadable JSON as an invalid response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(fetchAirQuality(DELHI, { fetchImpl })).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it("distinguishes aborted requests", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(fetchAirQuality(DELHI, { fetchImpl })).rejects.toMatchObject({ kind: "aborted" });
  });

  it("falls back to the global model when the European model has no data for the point", async () => {
    const hourly = (delhiRaw as unknown as { hourly: Record<string, unknown[]> }).hourly;
    const empty = {
      ...(delhiRaw as object),
      current: { time: "2026-11-17T22:00" },
      hourly: { time: hourly.time, pm2_5: (hourly.time ?? []).map(() => null) },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(empty))
      .mockResolvedValueOnce(jsonResponse(delhiRaw));
    const s = await fetchAirQuality(BERLIN, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("domains=cams_global");
    expect(s.model.id).toBe("cams_global");
    expect(isEmptySnapshot(s)).toBe(false);
  });
});
