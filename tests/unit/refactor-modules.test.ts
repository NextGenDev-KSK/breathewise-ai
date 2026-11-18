import { describe, expect, it } from "vitest";
import { maxBy, mean, minBy, presentValues, roundTo } from "@/lib/math";
import { completedToday, EMPTY_CHECKLIST_PROGRESS, toggleChecklistItem } from "@/lib/engine/checklist";
import { isOpenAirMode, parseCommuteForm } from "@/lib/engine/emissions";
import { concernLevelFor } from "@/lib/air/indices";
import { isSameOriginRequest } from "@/lib/security/origin";
import { detectActivity, detectPollutant } from "@/lib/ai/fallback/intents";
import { assistantModeLabel, FALLBACK_NOTICES } from "@/lib/ai/notices";
import { ASSISTANT_ERROR_CODES } from "@/lib/ai/schema";
import { baseConfidence, sourceLabel } from "@/lib/engine/provenance";
import { findOutdoorWindow } from "@/lib/engine/windows";
import { formatTime24, HOUR_MS, weekdayShort } from "@/lib/time";
import { summarizeSeries } from "@/components/air/HourlyChart";
import { makeSnapshot, prefs } from "../fixtures/builders";

describe("math helpers", () => {
  it("computes means and rounding", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNull();
    expect(roundTo(86.649, 1)).toBe(86.6);
    expect(roundTo(152.5)).toBe(153);
  });
  it("drops missing values without treating them as zero", () => {
    expect(presentValues([3, null, 0, null])).toEqual([3, 0]);
  });
  it("finds extremes, skipping nulls and keeping the earliest tie", () => {
    const items = [{ v: 5 }, { v: null }, { v: 2 }, { v: 2 }, { v: 9 }];
    expect(minBy(items, (i) => i.v)).toBe(items[2]);
    expect(maxBy(items, (i) => i.v)).toBe(items[4]);
    expect(minBy([{ v: null }], (i) => i.v)).toBeNull();
    expect(maxBy([], () => 1)).toBeNull();
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

describe("daily indoor checklist", () => {
  it("ticks and unticks items for today", () => {
    let progress = toggleChecklistItem(EMPTY_CHECKLIST_PROGRESS, "dust-mop", "2026-11-17");
    expect([...completedToday(progress, "2026-11-17")]).toEqual(["dust-mop"]);
    progress = toggleChecklistItem(progress, "dust-mop", "2026-11-17");
    expect(completedToday(progress, "2026-11-17").size).toBe(0);
  });
  it("starts fresh on a new day", () => {
    const yesterday = toggleChecklistItem(EMPTY_CHECKLIST_PROGRESS, "src-smoke", "2026-11-16");
    expect(completedToday(yesterday, "2026-11-17").size).toBe(0);
    expect(toggleChecklistItem(yesterday, "dust-mop", "2026-11-17")).toEqual({
      date: "2026-11-17",
      done: ["dust-mop"],
    });
  });
});

describe("parseCommuteForm", () => {
  const form = {
    distanceKm: "10",
    tripsPerDay: "2",
    daysPerWeek: "5",
    currentMode: "car",
    alternativeMode: "metro",
  } as const;
  it("converts typed text into validated numbers", () => {
    expect(parseCommuteForm(form)).toEqual({
      ok: true,
      input: { ...form, distanceKm: 10, tripsPerDay: 2, daysPerWeek: 5 },
    });
  });
  it("reports one message per invalid field", () => {
    const result = parseCommuteForm({ ...form, distanceKm: "", tripsPerDay: "0", daysPerWeek: "9" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        distanceKm: "Enter a distance in kilometres.",
        tripsPerDay: "At least 1 trip per day.",
        daysPerWeek: "At most 7 days per week.",
      });
    }
  });
  it("classifies open-air modes", () => {
    expect(isOpenAirMode("cycle")).toBe(true);
    expect(isOpenAirMode("two_wheeler")).toBe(true);
    expect(isOpenAirMode("metro")).toBe(false);
  });
});

describe("isSameOriginRequest", () => {
  const url = "https://breathewise.example/api/assistant";
  it("trusts the browser's Sec-Fetch-Site header", () => {
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-origin" }), url)).toBe(true);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "none" }), url)).toBe(true);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "cross-site" }), url)).toBe(false);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-site" }), url)).toBe(false);
  });
  it("falls back to comparing Origin with the request host", () => {
    expect(isSameOriginRequest(new Headers({ origin: "https://breathewise.example" }), url)).toBe(true);
    expect(isSameOriginRequest(new Headers({ origin: "https://evil.example" }), url)).toBe(false);
    expect(isSameOriginRequest(new Headers({ origin: "::bad::" }), url)).toBe(false);
  });
  it("allows non-browser clients that send neither header", () => {
    expect(isSameOriginRequest(new Headers(), url)).toBe(true);
  });
});

describe("assistant intents and notices", () => {
  it("detects the activity and pollutant a question is about", () => {
    expect(detectActivity("Can I go for a run?", prefs())).toBe("jogging");
    expect(detectActivity("Anything outside?", prefs({ outdoorActivity: "cycling" }))).toBe("cycling");
    expect(detectActivity("Anything outside?", prefs({ outdoorActivity: "none" }))).toBe("walking");
    expect(detectPollutant("Is ozone bad?")).toBe("ozone");
    expect(detectPollutant("What about NO2?")).toBe("nitrogen_dioxide");
    expect(detectPollutant("Explain the AQI")).toBe("pm2_5");
  });
  it("has a user-facing notice for every server error code", () => {
    for (const code of ASSISTANT_ERROR_CODES) expect(FALLBACK_NOTICES[code].length).toBeGreaterThan(10);
  });
  it("labels the answering engine", () => {
    expect(assistantModeLabel({ aiEnabled: false, configured: true, hasData: true })).toMatch(/turned off/);
    expect(assistantModeLabel({ aiEnabled: true, configured: null, hasData: true })).toMatch(/Checking/);
    expect(assistantModeLabel({ aiEnabled: true, configured: false, hasData: true })).toMatch(
      /not configured/,
    );
    expect(assistantModeLabel({ aiEnabled: true, configured: true, hasData: false })).toMatch(
      /until a location/,
    );
    expect(assistantModeLabel({ aiEnabled: true, configured: true, hasData: true })).toBe(
      "Gemini AI, grounded in your local data",
    );
  });
});

describe("provenance", () => {
  it("labels sources and lowers confidence for sample, saved or stale data", () => {
    const live = makeSnapshot({ pm25: [40], model: "cams_europe" });
    expect(sourceLabel(live.snapshot)).toMatch(/via Open-Meteo/);
    expect(baseConfidence(live.snapshot, live.nowMs)).toBe("high");
    expect(baseConfidence(makeSnapshot({ pm25: [40] }).snapshot, live.nowMs)).toBe("medium");
    expect(baseConfidence(makeSnapshot({ pm25: [40], origin: "cache" }).snapshot, live.nowMs)).toBe("low");
    expect(baseConfidence(live.snapshot, live.nowMs + 4 * HOUR_MS)).toBe("low");
    expect(sourceLabel(makeSnapshot({ pm25: [40], origin: "demo" }).snapshot)).toMatch(/Sample/);
  });
});

describe("regressions fixed during the refactor", () => {
  it("window end times are computed from absolute time (latent midnight-wrap defect)", () => {
    // The old string arithmetic turned 23:00 + 1 h into "…T00:00" on the SAME date. Current activity
    // hours end by 22:00, so it was unreachable, but end times now come from epoch arithmetic.
    const pm = Array.from({ length: 24 }, (_, h) => (h === 21 ? 5 : 60));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T18:00" });
    const result = findOutdoorWindow(snapshot, { activity: "walking", household: prefs().household, nowMs });
    expect(result.best?.startTime).toBe("2026-11-17T21:00");
    expect(result.best?.endTime).toBe("2026-11-17T22:00");
    expect(result.best?.startMs).toBe(nowMs + 3 * HOUR_MS);
  });

  it("chart summaries treat a zero reading as data, not as missing", () => {
    const summary = summarizeSeries(
      [
        { time: "2026-11-17T06:00", value: 0, level: 0 },
        { time: "2026-11-17T07:00", value: 12, level: 1 },
      ],
      "PM2.5",
      formatTime24,
    );
    expect(summary).toBe("PM2.5 ranges from 0 (lowest at 06:00) to 12 (highest at 07:00) across 2 hours.");
  });

  it("shows short weekday names", () => {
    expect(weekdayShort("2026-11-17")).toBe("Tue");
  });
});
