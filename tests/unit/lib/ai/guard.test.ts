import { describe, expect, it } from "vitest";
import { findUnsupportedClaims, humanizeTimestamps } from "@/lib/ai/guard";
import { delhiContext, GOOD_RESPONSE } from "@/tests/fixtures/ai";

describe("findUnsupportedClaims", () => {
  const ctx = delhiContext();
  it("accepts a grounded response", () => {
    expect(findUnsupportedClaims(GOOD_RESPONSE, ctx)).toEqual([]);
  });
  it("rejects invented concentrations and index values", () => {
    expect(findUnsupportedClaims({ ...GOOD_RESPONSE, risk_context: "PM2.5 is 300 µg/m³." }, ctx)[0]).toMatch(
      /unsupported concentration/,
    );
    expect(
      findUnsupportedClaims({ ...GOOD_RESPONSE, summary: "The AQI of 420 is hazardous." }, ctx)[0],
    ).toMatch(/unsupported index/);
  });
  it("allows rounding of real values", () => {
    expect(
      findUnsupportedClaims(
        { ...GOOD_RESPONSE, risk_context: "PM2.5 is about 87 µg/m³ and US AQI 152." },
        ctx,
      ),
    ).toEqual([]);
  });
  it("allows negated caveats", () => {
    expect(
      findUnsupportedClaims(
        {
          ...GOOD_RESPONSE,
          summary: "Comparatively better does not mean risk-free, and there is no guarantee.",
        },
        ctx,
      ),
    ).toEqual([]);
  });
  it("rejects guarantees, safety claims and quantified benefits", () => {
    expect(
      findUnsupportedClaims({ ...GOOD_RESPONSE, summary: "It is completely safe to go out." }, ctx).length,
    ).toBeGreaterThan(0);
    expect(
      findUnsupportedClaims({ ...GOOD_RESPONSE, timing: "This will reduce your exposure by 60%." }, ctx),
    ).toContain("quantified benefit claim");
    expect(
      findUnsupportedClaims({ ...GOOD_RESPONSE, summary: "We guarantee protection." }, ctx).length,
    ).toBeGreaterThan(0);
  });
});

describe("humanizeTimestamps", () => {
  it("rewrites raw timestamps relative to the data's local date", () => {
    const r = humanizeTimestamps(
      {
        ...GOOD_RESPONSE,
        summary: "Walk between 2026-11-17T15:00 and 2026-11-18T07:00, or on 2026-11-20T09:00.",
      },
      "2026-11-17",
    );
    expect(r.summary).toBe("Walk between 15:00 today and 07:00 tomorrow, or on Fri 20 Nov, 09:00.");
    expect(r.top_actions).toEqual(GOOD_RESPONSE.top_actions);
  });
});
