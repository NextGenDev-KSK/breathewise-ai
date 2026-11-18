import { describe, expect, it } from "vitest";
import { formatConcentration, guidelineRatio, POLLUTANTS } from "@/lib/air/pollutants";

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
