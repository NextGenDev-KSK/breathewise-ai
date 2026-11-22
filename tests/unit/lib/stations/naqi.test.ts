import { describe, expect, it } from "vitest";
import { average24h, computeNaqi, max8hAverage, naqiCategory, subIndex } from "@/lib/stations/naqi";

const hours = (value: number, count = 24) => Array.from({ length: count }, () => value);

describe("CPCB sub-index (linear within each band)", () => {
  it.each([
    ["pm2_5", 0, 0],
    ["pm2_5", 30, 50], // top of Good is inclusive
    ["pm2_5", 45, 75], // 50 + (45 − 30) × 50 / 30
    ["pm2_5", 250, 400],
    ["pm10", 300, 250], // 200 + (300 − 250) × 100 / 100
    ["ozone", 180, 230], // 200 + (180 − 168) × 100 / 40
    ["carbon_monoxide", 1.5, 75], // mg/m³
    ["sulphur_dioxide", 80, 100],
  ] as const)("%s at %s gives %s", (pollutant, concentration, expected) => {
    expect(subIndex(pollutant, concentration)).toMatchObject({ index: expected, aboveScale: false });
  });

  it("reports 401+ above the Severe threshold instead of extrapolating", () => {
    expect(subIndex("pm2_5", 251)).toMatchObject({ index: 401, aboveScale: true });
    expect(subIndex("pm10", 600)).toMatchObject({ index: 401, aboveScale: true });
  });

  it("rejects negative and non-finite concentrations", () => {
    expect(subIndex("pm2_5", -1)).toBeNull();
    expect(subIndex("pm2_5", Number.NaN)).toBeNull();
  });
});

describe("naqiCategory", () => {
  it.each([
    [0, "Good", 0],
    [50, "Good", 0],
    [51, "Satisfactory", 1],
    [200, "Moderately polluted", 2],
    [250, "Poor", 3],
    [301, "Very poor", 4],
    [401, "Severe", 5],
  ] as const)("%s is %s", (index, category, level) => {
    expect(naqiCategory(index)).toEqual({ category, level });
  });
});

describe("averaging rules", () => {
  it("needs at least 16 hourly values for a 24-hour average and ignores gaps", () => {
    expect(average24h([...hours(40, 15), ...hours(Number.NaN, 9)])).toBeNull();
    expect(average24h([...hours(40, 8), ...hours(80, 8), null, null])).toBe(60);
  });

  it("takes the highest 8-hour running average, skipping windows with fewer than 6 values", () => {
    const series = [...hours(20, 8), ...hours(100, 8), ...hours(20, 8)];
    expect(max8hAverage(series)).toBe(100);
    expect(max8hAverage([100, 100, 100, 100, 100, null, null, null, 10, 10])).toBeNull();
    expect(max8hAverage(hours(50, 7))).toBeNull();
  });
});

describe("computeNaqi", () => {
  it("is the highest sub-index, naming the prominent pollutant", () => {
    const result = computeNaqi({ pm2_5: hours(45), nitrogen_dioxide: hours(100), ozone: hours(50) });
    expect(result).toMatchObject({
      ok: true,
      index: 120, // NO₂: 100 + (100 − 80) × 100 / 100
      category: "Moderately polluted",
      level: 2,
      prominent: { pollutant: "nitrogen_dioxide" },
    });
    if (result.ok) expect(result.subIndices.map((s) => s.index)).toEqual([120, 75, 50]);
  });

  it("carries 401+ through to the overall index", () => {
    const result = computeNaqi({ pm2_5: hours(300), pm10: hours(200), nitrogen_dioxide: hours(60) });
    expect(result).toMatchObject({ ok: true, index: 401, aboveScale: true, category: "Severe" });
  });

  it("needs PM2.5 or PM10 among the pollutants", () => {
    const result = computeNaqi({ nitrogen_dioxide: hours(60), sulphur_dioxide: hours(20), ozone: hours(40) });
    expect(result).toMatchObject({ ok: false, reason: expect.stringMatching(/PM2.5 or PM10/) });
  });

  it("needs at least three pollutants with enough data, and says how many it has", () => {
    const result = computeNaqi({ pm2_5: hours(45), pm10: hours(90), nitrogen_dioxide: hours(60, 10) });
    expect(result).toMatchObject({ ok: false, reason: expect.stringMatching(/this station has 2/) });
    expect(result.subIndices).toHaveLength(2);
  });
});
