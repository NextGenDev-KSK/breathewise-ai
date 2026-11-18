import { describe, expect, it, vi } from "vitest";
import {
  buildGeocodingUrl,
  parseGeocodingResults,
  placeFromCoordinates,
  placeLabel,
  sanitizeQuery,
  searchPlaces,
  GeocodingError,
} from "@/lib/air/geocoding";
import pune from "@/tests/fixtures/geocoding-pune.json";
import { jsonResponse } from "@/tests/fixtures/http";

describe("sanitizeQuery", () => {
  it("trims, collapses whitespace and strips control characters", () => {
    expect(sanitizeQuery("  New   Delhi\u0007 ")).toBe("New Delhi");
  });
  it("rejects too-short queries and caps length", () => {
    expect(sanitizeQuery("a")).toBeNull();
    expect(sanitizeQuery("   ")).toBeNull();
    expect(sanitizeQuery("x".repeat(500))).toHaveLength(80);
  });
});

describe("geocoding", () => {
  it("builds an encoded URL", () => {
    const url = new URL(buildGeocodingUrl("São Paulo & <script>"));
    expect(url.searchParams.get("name")).toBe("São Paulo & <script>");
    expect(url.searchParams.get("count")).toBe("8");
  });

  it("parses real results (captured Pune response)", () => {
    const places = parseGeocodingResults(pune);
    expect(places[0]).toMatchObject({ name: "Pune", country: "India", countryCode: "IN", source: "search" });
    expect(placeLabel(places[0]!)).toBe("Pune, Maharashtra, India");
  });

  it("drops malformed entries and handles no results", () => {
    expect(
      parseGeocodingResults({ results: [{ id: 1, name: "X", latitude: 999, longitude: 0 }, { foo: 1 }] }),
    ).toEqual([]);
    expect(parseGeocodingResults({ generationtime_ms: 1 })).toEqual([]);
    expect(() => parseGeocodingResults("nope")).toThrow(GeocodingError);
  });

  it("searches via a mocked fetch and skips too-short queries", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(pune, 200));
    expect(await searchPlaces("p", { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    const results = await searchPlaces("Pune", { fetchImpl });
    expect(results.length).toBeGreaterThan(0);
  });

  it("maps failures to typed errors", async () => {
    await expect(
      searchPlaces("Pune", { fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 503 })) }),
    ).rejects.toMatchObject({ kind: "http" });
    await expect(
      searchPlaces("Pune", { fetchImpl: vi.fn().mockRejectedValue(new TypeError("offline")) }),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("rounds detected coordinates to about 1 km", () => {
    const p = placeFromCoordinates(28.613939, 77.209021);
    expect(p).toMatchObject({ latitude: 28.61, longitude: 77.21, source: "geolocation" });
  });
});
