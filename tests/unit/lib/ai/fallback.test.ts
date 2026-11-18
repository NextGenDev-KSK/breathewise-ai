import { describe, expect, it } from "vitest";
import { AssistantResponseSchema } from "@/lib/ai/schema";
import { findUnsupportedClaims } from "@/lib/ai/guard";
import { buildRuleBasedAnswer, detectIntent } from "@/lib/ai/fallback";
import { DELHI_NOW, prefs } from "@/tests/fixtures/builders";
import { delhiContext, delhiSnapshot } from "@/tests/fixtures/ai";
import { detectActivity, detectPollutant } from "@/lib/ai/fallback/intents";

describe("rule-based fallback", () => {
  const snapshot = delhiSnapshot();
  it.each([
    ["Is it a good time to go walking?", "outdoor"],
    ["How can I improve air quality in my bedroom?", "indoor"],
    ["My child has school tomorrow. What precautions should I consider?", "children"],
    ["Suggest a low-emission commute.", "commute"],
    ["Create a daily routine for my family.", "routine"],
    ["Why is PM2.5 particularly concerning?", "education"],
    ["Tell me a joke", "general"],
  ])("detects intent for %j and returns a schema-valid answer", (q, intent) => {
    expect(detectIntent(q)).toBe(intent);
    const a = buildRuleBasedAnswer({ message: q, snapshot, preferences: prefs(), nowMs: DELHI_NOW });
    expect(AssistantResponseSchema.safeParse(a).success).toBe(true);
    expect(findUnsupportedClaims(a, delhiContext())).toEqual([]);
  });

  it("explains PM2.5 with its WHO guideline", () => {
    const a = buildRuleBasedAnswer({
      message: "Why is PM2.5 concerning?",
      snapshot,
      preferences: prefs(),
      nowMs: DELHI_NOW,
    });
    expect(a.summary).toContain("WHO 2021 24-hour guideline is 15");
  });

  it("states uncertainty and the CPCB distinction for India", () => {
    const a = buildRuleBasedAnswer({
      message: "What should I change today?",
      snapshot,
      preferences: prefs(),
      nowMs: DELHI_NOW,
    });
    expect(a.uncertainties.join(" ")).toMatch(/not the official CPCB/);
    expect(a.risk_context).toContain("152");
  });

  it("works without any environmental data", () => {
    const a = buildRuleBasedAnswer({
      message: "Is it a good time to go walking?",
      snapshot: null,
      preferences: prefs(),
      nowMs: DELHI_NOW,
    });
    expect(AssistantResponseSchema.safeParse(a).success).toBe(true);
    expect(a.uncertainties[0]).toMatch(/No environmental data/);
  });
});

describe("fallback intent detection", () => {
  it("detects the activity and pollutant a question is about", () => {
    expect(detectActivity("Can I go for a run?", prefs())).toBe("jogging");
    expect(detectActivity("Anything outside?", prefs({ outdoorActivity: "cycling" }))).toBe("cycling");
    expect(detectActivity("Anything outside?", prefs({ outdoorActivity: "none" }))).toBe("walking");
    expect(detectPollutant("Is ozone bad?")).toBe("ozone");
    expect(detectPollutant("What about NO2?")).toBe("nitrogen_dioxide");
    expect(detectPollutant("Explain the AQI")).toBe("pm2_5");
  });
});
