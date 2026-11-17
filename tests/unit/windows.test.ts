import { describe, expect, it } from "vitest";
import { decideVerdict, findOutdoorWindow } from "@/lib/engine/windows";
import { makeSnapshot } from "../fixtures/builders";

const noHousehold = { children: false, olderAdults: false, respiratorySensitivity: false };

describe("findOutdoorWindow", () => {
  it("picks the comparatively cleanest hour", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 15 ? 10 : 40));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T06:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.status).toBe("ok");
    expect(r.best?.startTime).toBe("2026-11-17T15:00");
    expect(r.best?.endTime).toBe("2026-11-17T16:00");
    expect(r.metric).toBe("pm2_5"); // hourly PM2.5, not the 24-h-averaged AQI
    expect(r.verdict).toBe("reasonable");
    expect(r.headline).toBe("Comparatively better window: 15:00–16:00");
  });

  it("never calls any time safe", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: Array(24).fill(3), nowLocal: "2026-11-17T06:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(JSON.stringify(r).toLowerCase()).not.toContain("safe");
  });

  it("says so when every forecast hour is poor", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: Array(24).fill(100), nowLocal: "2026-11-17T06:00" }); // US AQI ≈ 200
    const r = findOutdoorWindow(snapshot, { activity: "jogging", household: noHousehold, nowMs });
    expect(r.verdict).toBe("avoid");
    expect(r.headline).toMatch(/all forecast hours are poor/i);
    expect(r.cautions.join(" ")).toMatch(/indoor alternative/i);
  });

  it("is more cautious for vigorous activity and sensitive households", () => {
    expect(decideVerdict(2, "light", false)).toBe("reasonable");
    expect(decideVerdict(2, "vigorous", false)).toBe("reduce");
    expect(decideVerdict(2, "light", true)).toBe("reduce");
    expect(decideVerdict(3, "light", false)).toBe("reduce");
    expect(decideVerdict(3, "light", true)).toBe("avoid");
    expect(decideVerdict(4, "light", false)).toBe("avoid");
    expect(decideVerdict(1, "vigorous", true)).toBe("reduce");
  });

  it("treats children's play as involving a sensitive group", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: Array(24).fill(40), nowLocal: "2026-11-17T06:00" }); // AQI 80 = moderate
    const r = findOutdoorWindow(snapshot, { activity: "children_play", household: noHousehold, nowMs });
    expect(r.cautions.join(" ")).toMatch(/children/i);
  });

  it("respects realistic hours and an explicit hour range", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 2 ? 1 : h === 9 ? 5 : 50));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T00:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.best?.startTime).toBe("2026-11-17T09:00"); // 02:00 is outside walking hours
    const evening = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs, hourRange: { start: 17, end: 22 } });
    expect(Number(evening.best?.startTime.slice(11, 13))).toBeGreaterThanOrEqual(17);
  });

  it("ignores past hours", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 8 ? 1 : 50));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T12:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.best?.startTime).not.toBe("2026-11-17T08:00");
  });

  it("does not treat missing values as clean (zero)", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 10 ? null : 50));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T06:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.best?.startTime).not.toBe("2026-11-17T10:00");
  });

  it("reports insufficient data instead of guessing", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: Array(24).fill(null), usAqi: Array(24).fill(null), nowLocal: "2026-11-17T06:00" });
    snapshot.hourly.forEach((h) => (h.european_aqi = null));
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.status).toBe("insufficient-data");
    expect(r.verdict).toBe("unknown");
    expect(r.best).toBeNull();
  });

  it("flags uncertainty when many hours are missing", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h % 2 ? null : 30));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T06:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.uncertain).toBe(true);
    expect(r.uncertaintyNotes.join(" ")).toMatch(/less certain/);
  });

  it("formats times with the injected formatter", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 15 ? 10 : 40));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T06:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs, formatTime: () => "X" });
    expect(r.headline).toBe("Comparatively better window: X–X");
  });
});

describe("metric choice", () => {
  it("ranks by hourly PM2.5 even when the lagging 24-h US AQI points elsewhere", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 14 ? 20 : 80));
    const aqi = Array.from({ length: 24 }, (_, h) => (h === 6 ? 100 : 160)); // AQI lowest at 06:00
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, usAqi: aqi, nowLocal: "2026-11-17T05:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.best?.startTime).toBe("2026-11-17T14:00");
  });

  it("labels windows that fall tomorrow", () => {
    const pm = Array.from({ length: 48 }, (_, h) => (h === 30 ? 5 : 60));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T22:00" });
    const r = findOutdoorWindow(snapshot, { activity: "walking", household: noHousehold, nowMs });
    expect(r.best?.dayLabel).toBe("Tomorrow");
    expect(r.headline).toBe("Comparatively better window: Tomorrow 06:00–07:00");
  });
});
