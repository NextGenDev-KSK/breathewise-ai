import { describe, expect, it } from "vitest";
import { generateRecommendations } from "@/lib/engine/recommendations";
import { BERLIN, DIURNAL, makeSnapshot, prefs } from "@/tests/fixtures/builders";

const REQUIRED = [
  "id",
  "category",
  "title",
  "description",
  "reason",
  "recommendedTime",
  "impactType",
  "confidence",
  "source",
  "limitations",
  "priority",
];

describe("generateRecommendations", () => {
  const poor = makeSnapshot({ pm25: Array(48).fill(90), nowLocal: "2026-11-17T08:00" }); // US AQI ≈ 180

  it("returns recommendations with the full structured contract", () => {
    const recs = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs(),
      nowMs: poor.nowMs,
    });
    expect(recs.length).toBeGreaterThan(3);
    for (const r of recs) for (const k of REQUIRED) expect(r).toHaveProperty(k);
  });

  it("is sorted by priority", () => {
    const recs = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs(),
      nowMs: poor.nowMs,
    });
    const priorities = recs.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("adds sensitive-household caution only when relevant", () => {
    const without = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs(),
      nowMs: poor.nowMs,
    });
    const withKids = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs({
        household: { children: true, olderAdults: false, respiratorySensitivity: false },
      }),
      nowMs: poor.nowMs,
    });
    expect(without.find((r) => r.id === "household-sensitive")).toBeUndefined();
    const h = withKids.find((r) => r.id === "household-sensitive");
    expect(h?.description).toMatch(/children/);
    expect(h?.priority).toBe(1);
  });

  it("tailors purification to equipment", () => {
    const a = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs({ equipment: { airPurifier: true, kitchenExhaust: false } }),
      nowMs: poor.nowMs,
    });
    const b = generateRecommendations({ snapshot: poor.snapshot, preferences: prefs(), nowMs: poor.nowMs });
    expect(a.find((r) => r.id === "purification")?.title).toMatch(/Run your air purifier/);
    expect(b.find((r) => r.id === "purification")?.title).toMatch(/cleaner room/);
    expect(a.find((r) => r.id === "purification")?.caution).toMatch(/ozone-generating/);
  });

  it("advises limiting ventilation when outdoor air is poor and favours it when clean", () => {
    const clean = makeSnapshot({ pm25: Array(48).fill(5), nowLocal: "2026-11-17T08:00" });
    expect(
      generateRecommendations({ snapshot: poor.snapshot, preferences: prefs(), nowMs: poor.nowMs }).find(
        (r) => r.id === "ventilation",
      )?.title,
    ).toMatch(/closed/);
    expect(
      generateRecommendations({ snapshot: clean.snapshot, preferences: prefs(), nowMs: clean.nowMs }).find(
        (r) => r.id === "ventilation",
      )?.title,
    ).toMatch(/air out/);
  });

  it("keeps CO₂e separate from AQI in commute advice", () => {
    const recs = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs({ commuteMode: "car" }),
      nowMs: poor.nowMs,
    });
    const c = recs.find((r) => r.id === "commute-lower-emission");
    expect(c?.impactType).toBe("emissions-reduction");
    expect(c?.description).toContain("138 g CO₂e");
    expect(c?.limitations.join(" ")).toMatch(/not a measurable change in today's local AQI/);
  });

  it("warns open-air commuters on high-pollution days without claiming cleaner routes", () => {
    const recs = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs({ commuteMode: "cycle" }),
      nowMs: poor.nowMs,
    });
    const c = recs.find((r) => r.id === "commute-exposure");
    expect(c?.limitations.join(" ")).toMatch(/no route is claimed to be cleaner/i);
  });

  it("points Indian users to official CPCB readings, but not others", () => {
    const india = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs(),
      nowMs: poor.nowMs,
    });
    expect(india.some((r) => r.id === "data-cpcb")).toBe(true);
    const berlin = makeSnapshot({ pm25: Array(48).fill(20), nowLocal: "2026-11-17T08:00", place: BERLIN });
    berlin.snapshot.timezone = "Europe/Berlin";
    expect(
      generateRecommendations({ snapshot: berlin.snapshot, preferences: prefs(), nowMs: berlin.nowMs }).some(
        (r) => r.id === "data-cpcb",
      ),
    ).toBe(false);
  });

  it("flags stale or cached data and lowers confidence", () => {
    const later = poor.nowMs + 5 * 3_600_000;
    const recs = generateRecommendations({ snapshot: poor.snapshot, preferences: prefs(), nowMs: later });
    expect(recs.find((r) => r.id === "data-stale")).toBeDefined();
    expect(recs.find((r) => r.id === "ventilation")?.confidence).toBe("low");
  });

  it("detects improving trends and points to the cleaner time", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: DIURNAL, nowLocal: "2026-11-17T08:00" });
    const recs = generateRecommendations({ snapshot, preferences: prefs(), nowMs });
    const t = recs.find((r) => r.id.startsWith("trend-"));
    expect(t?.id).toBe("trend-improving");
    expect(t?.evidence.length).toBeGreaterThan(1);
  });

  it("names the dominant pollutant from US AQI sub-indices", () => {
    const recs = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs(),
      nowMs: poor.nowMs,
    });
    expect(recs.find((r) => r.id === "pollutant-pm2_5")?.title).toMatch(/PM2.5 is driving/);
  });

  it("labels demo data as sample data in sources", () => {
    const demo = makeSnapshot({ pm25: Array(48).fill(90), nowLocal: "2026-11-17T08:00", origin: "demo" });
    const recs = generateRecommendations({
      snapshot: demo.snapshot,
      preferences: prefs(),
      nowMs: demo.nowMs,
    });
    expect(recs.every((r) => r.source.startsWith("Sample") || !r.source.includes("Open-Meteo"))).toBe(true);
    expect(recs.some((r) => r.id === "data-cpcb")).toBe(false);
  });

  it("never invents percentages or guarantees", () => {
    const recs = generateRecommendations({
      snapshot: poor.snapshot,
      preferences: prefs({ household: { children: true, olderAdults: true, respiratorySensitivity: true } }),
      nowMs: poor.nowMs,
    });
    const text = JSON.stringify(recs);
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text.toLowerCase()).not.toMatch(/guarantee|completely safe|risk-free/);
  });
});
