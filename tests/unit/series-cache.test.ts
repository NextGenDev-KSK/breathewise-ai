import { describe, expect, it } from "vitest";
import { buildSeries, summarizeDays } from "@/lib/air/series";
import { concernLevelFor as levelFor } from "@/lib/air/indices";
import { cacheKey, clearCache, getCached, setCached, CACHE_TTL_MS } from "@/lib/air/cache";
import { makeSnapshot } from "../fixtures/builders";

describe("series", () => {
  it("assigns levels per metric and keeps missing values null", () => {
    expect(levelFor("pm2_5", 86.6)).toBe(3);
    expect(levelFor("pm10", 160)).toBe(2);
    expect(levelFor("us_aqi", 152)).toBe(3);
    expect(levelFor("european_aqi", 78)).toBe(3);
    expect(levelFor("pm2_5", null)).toBeNull();
    const { snapshot } = makeSnapshot({ pm25: [10, null, 50] });
    expect(buildSeries(snapshot.hourly, "pm2_5").map((p) => p.value)).toEqual([10, null, 50]);
  });

  it("summarises days without treating gaps as zero", () => {
    const { snapshot } = makeSnapshot({ pm25: [...Array(24).fill(20), 10, null, 40] });
    const days = summarizeDays(snapshot.hourly);
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ date: "2026-11-17", hours: 24, pm25: { min: 20, max: 20, mean: 20 } });
    expect(days[1]!.pm25).toEqual({ min: 10, mean: 25, max: 40 });
  });
});

describe("response cache", () => {
  it("returns fresh entries and expires old ones", () => {
    clearCache();
    const { snapshot } = makeSnapshot({ pm25: [10] });
    setCached(snapshot);
    expect(getCached(snapshot.place, snapshot.fetchedAt + 1000)).not.toBeNull();
    expect(getCached(snapshot.place, snapshot.fetchedAt + CACHE_TTL_MS + 1)).toBeNull();
    expect(cacheKey({ latitude: 28.6519, longitude: 77.2315 })).toBe("28.65,77.23");
  });

  it("evicts beyond 20 locations", () => {
    clearCache();
    const first = makeSnapshot({ pm25: [1] }).snapshot;
    setCached({ ...first, place: { ...first.place, latitude: 0 } });
    for (let i = 1; i <= 20; i++) setCached({ ...first, place: { ...first.place, latitude: i } });
    expect(getCached({ ...first.place, latitude: 0 }, first.fetchedAt)).toBeNull();
    expect(getCached({ ...first.place, latitude: 20 }, first.fetchedAt)).not.toBeNull();
  });
});
