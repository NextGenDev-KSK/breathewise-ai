import { describe, expect, it } from "vitest";
import { buildDailyPlan, collectPeriods, periodOfHour } from "@/lib/engine/plan";
import { DIURNAL, makeSnapshot, prefs } from "@/tests/fixtures/builders";

describe("periodOfHour", () => {
  it.each([
    [6, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "evening"],
    [22, "night"],
    [3, "night"],
  ])("hour %i is %s", (h, p) => expect(periodOfHour(h)).toBe(p));
});

describe("buildDailyPlan", () => {
  const { snapshot, nowMs } = makeSnapshot({ pm25: DIURNAL, nowLocal: "2026-11-17T05:00" });

  it("covers morning, afternoon, evening and night with the next occurrence of each", () => {
    const plan = buildDailyPlan(snapshot, prefs(), nowMs);
    expect(plan.periods.map((p) => p.id)).toEqual(["morning", "afternoon", "evening", "night"]);
    expect(plan.periods[0]!.startTime).toBe("2026-11-17T06:00");
    expect(plan.periods[3]!.startTime).toBe("2026-11-17T22:00");
    for (const p of plan.periods) {
      expect(p.items.length).toBeGreaterThan(0);
      expect(p.stats).not.toBeNull();
    }
  });

  it("identifies the cleanest period from forecast means", () => {
    const plan = buildDailyPlan(snapshot, prefs(), nowMs);
    expect(plan.cleanestPeriod).toBe("afternoon");
    expect(plan.headline).toMatch(/Afternoon is forecast to be the cleanest/);
  });

  it("only schedules the activity in the preferred period", () => {
    const morning = buildDailyPlan(
      snapshot,
      prefs({ preferredActivityTime: "morning", outdoorActivity: "jogging" }),
      nowMs,
    );
    expect(morning.periods[0]!.items.some((i) => i.id === "morning-activity")).toBe(true);
    expect(morning.periods[2]!.items.some((i) => i.id === "evening-activity")).toBe(false);
  });

  it("includes commute items only for commuters", () => {
    const home = buildDailyPlan(snapshot, prefs({ routine: "home" }), nowMs);
    expect(
      home.periods.flatMap((p) => p.items).some((i) => i.category === "commute" && i.id.includes("commute-")),
    ).toBe(false);
    const office = buildDailyPlan(snapshot, prefs({ routine: "office", leaveTime: "09:00" }), nowMs);
    expect(office.periods[0]!.items.find((i) => i.id === "morning-commute-out")?.recommendedTime).toBe(
      "09:00",
    );
  });

  it("every item carries timing, evidence or limitations for explainability", () => {
    const plan = buildDailyPlan(snapshot, prefs(), nowMs);
    for (const item of plan.periods.flatMap((p) => p.items)) {
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
    }
  });

  it("adapts when conditions change", () => {
    const poor = makeSnapshot({ pm25: Array(48).fill(150), nowLocal: "2026-11-17T05:00" });
    const plan = buildDailyPlan(poor.snapshot, prefs(), poor.nowMs);
    expect(plan.headline).toMatch(/poor all day/);
    expect(plan.periods[3]!.items[0]!.title).toMatch(/Keep the bedroom closed/);
  });

  it("labels demo plans as sample data", () => {
    const demo = makeSnapshot({ pm25: DIURNAL, nowLocal: "2026-11-17T05:00", origin: "demo" });
    expect(buildDailyPlan(demo.snapshot, prefs(), demo.nowMs).notes[0]).toMatch(/SAMPLE data/);
  });

  it("handles missing forecast data without inventing values", () => {
    const empty = makeSnapshot({
      pm25: Array(48).fill(null),
      usAqi: Array(48).fill(null),
      nowLocal: "2026-11-17T05:00",
    });
    empty.snapshot.hourly.forEach((h) => (h.european_aqi = null));
    const plan = buildDailyPlan(empty.snapshot, prefs(), empty.nowMs);
    expect(plan.cleanestPeriod).toBeNull();
    expect(plan.headline).toMatch(/Not enough forecast data/);
    expect(plan.periods.every((p) => p.stats === null)).toBe(true);
  });

  it("groups night across midnight", () => {
    const groups = collectPeriods(snapshot, nowMs);
    expect(groups.night.map((h) => h.time.slice(11, 13))).toEqual([
      "22",
      "23",
      "00",
      "01",
      "02",
      "03",
      "04",
      "05",
    ]);
  });
});

describe("plan ordering", () => {
  it("lists periods chronologically from now", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: DIURNAL, nowLocal: "2026-11-17T22:30" });
    const plan = buildDailyPlan(snapshot, prefs(), nowMs);
    expect(plan.periods.map((p) => p.id)).toEqual(["night", "morning", "afternoon", "evening"]);
    expect(plan.periods[0]!.dayLabel).toBe("Today");
    expect(plan.periods[1]!.dayLabel).toBe("Tomorrow");
  });
});
