import { describe, expect, it } from "vitest";
import { buildIndoorChecklist, getVentilationAdvice, recommendedCadr } from "@/lib/engine/indoor";
import { makeSnapshot, prefs } from "@/tests/fixtures/builders";

describe("getVentilationAdvice", () => {
  it("is favourable when outdoor air is low", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: Array(24).fill(5) });
    expect(getVentilationAdvice(snapshot, nowMs).status).toBe("favourable");
  });

  it("limits ventilation when outdoor air is high and points to a cleaner hour", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 8 ? 20 : 100));
    const { snapshot, nowMs } = makeSnapshot({ pm25: pm, nowLocal: "2026-11-17T02:00" });
    const a = getVentilationAdvice(snapshot, nowMs);
    expect(a.status).toBe("limit");
    expect(a.nextBetterTime).toBe("2026-11-17T08:00");
    expect(a.description).toContain("08:00");
  });

  it("reports unknown without data", () => {
    const { snapshot, nowMs } = makeSnapshot({ pm25: Array(24).fill(null), usAqi: Array(24).fill(null) });
    snapshot.current.europeanAqi = null;
    expect(getVentilationAdvice(snapshot, nowMs).status).toBe("unknown");
  });
});

describe("buildIndoorChecklist", () => {
  it("personalises by equipment, fuel and household", () => {
    const ids = (p: ReturnType<typeof prefs>, level: 0 | 3) =>
      buildIndoorChecklist(p, level).map((i) => i.id);
    expect(ids(prefs({ equipment: { airPurifier: true, kitchenExhaust: true } }), 3)).toEqual(
      expect.arrayContaining(["pur-run", "pur-filter", "cook-exhaust", "vent-closed"]),
    );
    expect(ids(prefs(), 0)).toEqual(
      expect.arrayContaining(["pur-clean-room", "cook-ventilate", "vent-air-out"]),
    );
    expect(ids(prefs({ cookingFuel: "biomass" }), 0)).toContain("cook-biomass");
    expect(
      ids(prefs({ household: { children: true, olderAdults: false, respiratorySensitivity: false } }), 0),
    ).toContain("pur-bedroom");
  });

  it("never suggests plants as filtration or ozone generators", () => {
    const text = JSON.stringify(buildIndoorChecklist(prefs(), 3)).toLowerCase();
    expect(text).not.toContain("plant");
    expect(text).not.toContain("ioniz");
  });
});

describe("recommendedCadr", () => {
  it("applies the 2/3 rule of thumb", () => {
    expect(recommendedCadr(12)).toEqual({ cfm: 87, m3h: 147 });
  });
  it("rejects invalid areas", () => {
    expect(recommendedCadr(0)).toBeNull();
    expect(recommendedCadr(-3)).toBeNull();
    expect(recommendedCadr(Number.NaN)).toBeNull();
    expect(recommendedCadr(1000)).toBeNull();
  });
});
