import { describe, expect, it } from "vitest";
import { cacheKey, clearCache, getCached, setCached, CACHE_TTL_MS } from "@/lib/air/cache";
import { makeSnapshot } from "@/tests/fixtures/builders";

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
