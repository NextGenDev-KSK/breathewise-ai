import { describe, expect, it } from "vitest";
import { buildAssistantContext, stationContextFrom } from "@/lib/ai/context";
import { findUnsupportedClaims } from "@/lib/ai/guard";
import { buildRuleBasedAnswer } from "@/lib/ai/fallback";
import { AssistantContextSchema } from "@/lib/ai/schema";
import { DEMO_STATION_REPORT } from "@/lib/demo/stations";
import { delhiContext, delhiSnapshot, GOOD_RESPONSE } from "@/tests/fixtures/ai";
import { DELHI_NOW, prefs } from "@/tests/fixtures/builders";

const station = stationContextFrom(DEMO_STATION_REPORT, { sample: true, utcOffsetSeconds: 19_800 });

describe("stationContextFrom", () => {
  it("keeps the station's name, distance, local reading time, values and index, but no coordinates", () => {
    expect(station).toEqual({
      name: "Lodhi Road, New Delhi - IMD",
      distanceKm: 2.6,
      measuredAt: "2026-11-22T08:30",
      sample: true,
      readings: [
        { pollutant: "PM10", value: 202, unit: "µg/m³" },
        { pollutant: "O₃", value: 26.4, unit: "µg/m³" },
        { pollutant: "PM2.5", value: 80.5, unit: "µg/m³" },
      ],
      nationalAqi: {
        index: 141,
        aboveScale: false,
        category: "Moderately polluted",
        prominentPollutant: "PM10",
        averages: [
          { pollutant: "PM10", average: 161, subIndex: 141 },
          { pollutant: "PM2.5", average: 69.2, subIndex: 131 },
          { pollutant: "O₃", average: 86.5, subIndex: 86 },
        ],
      },
    });
    expect(JSON.stringify(station)).not.toMatch(/latitude|longitude/);
  });

  it("is null without a station, and has no index when the station cannot give one", () => {
    expect(stationContextFrom(null, { sample: false, utcOffsetSeconds: 0 })).toBeNull();
    expect(
      stationContextFrom({ ...DEMO_STATION_REPORT, nearest: null }, { sample: false, utcOffsetSeconds: 0 }),
    ).toBeNull();
    const nearest = DEMO_STATION_REPORT.nearest!;
    const noIndex = {
      ...DEMO_STATION_REPORT,
      nearest: { ...nearest, naqi: { ok: false as const, reason: "x", subIndices: [] } },
    };
    expect(stationContextFrom(noIndex, { sample: false, utcOffsetSeconds: 0 })?.nationalAqi).toBeNull();
  });
});

describe("assistant context with station data", () => {
  it("validates, and stays valid for older clients that send no station", () => {
    const ctx = buildAssistantContext(delhiSnapshot(), prefs(), DELHI_NOW, station);
    expect(AssistantContextSchema.parse(ctx).station?.name).toBe("Lodhi Road, New Delhi - IMD");
    const legacy: Record<string, unknown> = { ...delhiContext() };
    Reflect.deleteProperty(legacy, "station");
    expect(AssistantContextSchema.parse(legacy).station).toBeNull();
  });

  it("lets answers quote station numbers, which are rejected without the station", () => {
    if (!station) throw new Error("expected station context");
    // 412.3 µg/m³ appears nowhere in the Delhi model data, so only the station can support it.
    const measured = { ...station, readings: [{ pollutant: "PM2.5", value: 412.3, unit: "µg/m³" }] };
    const answer = { ...GOOD_RESPONSE, risk_context: "The Lodhi Road monitor measured PM2.5 412.3 µg/m³." };
    expect(findUnsupportedClaims(answer, { ...delhiContext(), station: measured })).toEqual([]);
    expect(findUnsupportedClaims(answer, delhiContext())).toContain("unsupported concentration: 412.3 µg/m³");
  });

  it("gives rule-based answers the station reading, and they pass the grounding check", () => {
    const answer = buildRuleBasedAnswer({
      message: "Can I walk now?",
      snapshot: delhiSnapshot(),
      preferences: prefs(),
      nowMs: DELHI_NOW,
      station,
    });
    expect(answer.risk_context).toContain("Lodhi Road, New Delhi - IMD (sample capture)");
    expect(findUnsupportedClaims(answer, { ...delhiContext(), station })).toEqual([]);
  });
});
