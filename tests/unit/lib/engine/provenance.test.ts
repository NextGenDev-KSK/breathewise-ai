import { describe, expect, it } from "vitest";
import { baseConfidence, sourceLabel } from "@/lib/engine/provenance";
import { HOUR_MS } from "@/lib/time";
import { makeSnapshot } from "@/tests/fixtures/builders";

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
