import { describe, expect, it } from "vitest";
import { formatConcentration, guidelineRatio, POLLUTANTS } from "@/lib/air/pollutants";
import { clockToMinutes, epochToLocalTime, formatAge, formatClock, formatDay, localTimeToEpoch, relativeDayLabel } from "@/lib/time";

describe("pollutant formatting", () => {
  it("formats values with units", () => {
    expect(formatConcentration(86.64, "pm2_5")).toBe("86.6 µg/m³");
    expect(formatConcentration(1258, "carbon_monoxide")).toBe("1258 µg/m³");
    expect(formatConcentration(152.4, "pm10")).toBe("152 µg/m³");
  });

  it("shows missing values as not available, never as zero", () => {
    expect(formatConcentration(null, "ammonia")).toBe("Not available");
    expect(formatConcentration(undefined, "pm2_5")).toBe("Not available");
    expect(formatConcentration(Number.NaN, "pm2_5")).toBe("Not available");
  });

  it("computes the WHO guideline ratio only when both sides exist", () => {
    expect(guidelineRatio(30, "pm2_5")).toBe(2);
    expect(guidelineRatio(null, "pm2_5")).toBeNull();
    expect(guidelineRatio(10, "dust")).toBeNull();
    expect(POLLUTANTS.pm2_5.whoGuideline?.value).toBe(15);
  });
});

describe("time utilities", () => {
  it("round-trips local wall-clock times with a +05:30 offset", () => {
    const epoch = localTimeToEpoch("2026-11-17T22:30", 19_800);
    expect(new Date(epoch).toISOString()).toBe("2026-11-17T17:00:00.000Z");
    expect(epochToLocalTime(epoch, 19_800)).toBe("2026-11-17T22:30");
  });

  it("handles negative offsets and day boundaries", () => {
    const epoch = localTimeToEpoch("2026-01-01T00:00", -18_000);
    expect(epochToLocalTime(epoch, -18_000)).toBe("2026-01-01T00:00");
    expect(new Date(epoch).toISOString()).toBe("2026-01-01T05:00:00.000Z");
  });

  it("rejects malformed times", () => {
    expect(() => localTimeToEpoch("17/11/2026 10:00", 0)).toThrow();
  });

  it("formats clocks in 24h and 12h", () => {
    expect(formatClock("2026-11-17T06:00", "24h")).toBe("06:00");
    expect(formatClock("2026-11-17T06:00", "12h")).toBe("6 AM");
    expect(formatClock("2026-11-17T00:30", "12h")).toBe("12:30 AM");
    expect(formatClock("2026-11-17T13:00", "12h")).toBe("1 PM");
  });

  it("labels days relative to the location's date", () => {
    expect(relativeDayLabel("2026-11-17T08:00", "2026-11-17T22:00")).toBe("Today");
    expect(relativeDayLabel("2026-11-18T08:00", "2026-11-17T22:00")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-12-31T08:00", "2026-12-30T22:00")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-11-19T08:00", "2026-11-17T22:00")).toBe(formatDay("2026-11-19T08:00"));
    expect(formatDay("2026-11-17T08:00")).toBe("Tue 17 Nov");
  });

  it("describes data age", () => {
    expect(formatAge(0, 30_000)).toBe("just now");
    expect(formatAge(0, 12 * 60_000)).toBe("12 min ago");
    expect(formatAge(0, 5 * 3_600_000)).toBe("5 h ago");
    expect(clockToMinutes("09:30")).toBe(570);
  });
});
