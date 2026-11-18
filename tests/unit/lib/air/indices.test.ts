import { describe, expect, it } from "vitest";
import { assessConcern, euAqiBand, indexBand, pm25Band, usAqiBand, concernLevelFor } from "@/lib/air/indices";

describe("US AQI bands", () => {
  it.each([
    [0, "Good"],
    [50, "Good"],
    [51, "Moderate"],
    [100, "Moderate"],
    [101, "Unhealthy for Sensitive Groups"],
    [151, "Unhealthy"],
    [201, "Very Unhealthy"],
    [301, "Hazardous"],
    [612, "Hazardous"],
  ])("maps %i to %s", (value, label) => {
    expect(usAqiBand(value)?.label).toBe(label);
  });

  it("returns null for missing, negative or non-finite values", () => {
    expect(usAqiBand(null)).toBeNull();
    expect(usAqiBand(-1)).toBeNull();
    expect(usAqiBand(Number.NaN)).toBeNull();
  });
});

describe("European AQI bands", () => {
  it.each([
    [10, "Good"],
    [30, "Fair"],
    [50, "Moderate"],
    [70, "Poor"],
    [90, "Very poor"],
    [140, "Extremely poor"],
  ])("maps %i to %s", (value, label) => {
    expect(euAqiBand(value)?.label).toBe(label);
  });

  it("is selected by indexBand('eu')", () => {
    expect(indexBand("eu", 78)?.label).toBe("Poor");
    expect(indexBand("us", 78)?.label).toBe("Moderate");
  });
});

describe("PM2.5 concentration bands (EPA 2024 breakpoints)", () => {
  it("uses 9 µg/m³ as the top of the lowest band", () => {
    expect(pm25Band(9)?.level).toBe(0);
    expect(pm25Band(9.1)?.level).toBe(1);
    expect(pm25Band(86.6)?.level).toBe(3);
  });
});

describe("assessConcern", () => {
  it("prefers US AQI, then European AQI, then PM2.5", () => {
    expect(assessConcern({ us_aqi: 152, european_aqi: 10, pm2_5: 1 })).toMatchObject({
      basis: "US AQI",
      level: 3,
      standardLabel: "Unhealthy",
    });
    expect(assessConcern({ us_aqi: null, european_aqi: 78, pm2_5: 1 })).toMatchObject({
      basis: "European AQI",
      level: 3,
    });
    expect(assessConcern({ us_aqi: null, european_aqi: null, pm2_5: 40 })).toMatchObject({
      basis: "PM2.5 concentration",
      level: 2,
    });
  });

  it("returns null when nothing is available (never treats missing as zero)", () => {
    expect(assessConcern({ us_aqi: null, european_aqi: null, pm2_5: null })).toBeNull();
  });
});

describe("concernLevelFor", () => {
  it("maps every supported measure, including PM10", () => {
    expect(concernLevelFor("us_aqi", 152)).toBe(3);
    expect(concernLevelFor("european_aqi", 78)).toBe(3);
    expect(concernLevelFor("pm2_5", 9)).toBe(0);
    expect(concernLevelFor("pm10", 54)).toBe(0);
    expect(concernLevelFor("pm10", 500)).toBe(5);
  });
  it("returns null for missing or invalid values", () => {
    expect(concernLevelFor("pm10", null)).toBeNull();
    expect(concernLevelFor("us_aqi", -1)).toBeNull();
    expect(concernLevelFor("pm2_5", Number.POSITIVE_INFINITY)).toBeNull();
  });
});
