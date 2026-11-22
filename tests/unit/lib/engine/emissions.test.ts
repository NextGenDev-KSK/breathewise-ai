import { describe, expect, it } from "vitest";
import {
  calculateCommuteEmissions,
  CommuteInputSchema,
  EMISSION_FACTORS,
  savingPerKm,
  WEEKS_PER_MONTH,
  isOpenAirMode,
  parseCommuteForm,
} from "@/lib/engine/emissions";

describe("emission factors", () => {
  it("match the documented OECD 2023 Indian case-study values", () => {
    expect(EMISSION_FACTORS.car.gramsPerPassengerKm).toBe(162);
    expect(EMISSION_FACTORS.two_wheeler.gramsPerPassengerKm).toBe(65);
    expect(EMISSION_FACTORS.bus.gramsPerPassengerKm).toBe(28);
    expect(EMISSION_FACTORS.metro.gramsPerPassengerKm).toBe(24);
    expect(EMISSION_FACTORS.walk.gramsPerPassengerKm).toBe(0);
    expect(EMISSION_FACTORS.cycle.gramsPerPassengerKm).toBe(0);
  });

  it("estimates carpooling as the car factor split between three people", () => {
    expect(EMISSION_FACTORS.carpool.gramsPerPassengerKm).toBe(54);
    const r = calculateCommuteEmissions({
      distanceKm: 10,
      tripsPerDay: 2,
      daysPerWeek: 5,
      currentMode: "car",
      alternativeMode: "carpool",
    });
    expect(r.weeklySavingKg).toBe(10.8); // 100 pkm × (162 − 54) g
    expect(r.relativeChange).toBeCloseTo(-2 / 3, 5);
    expect(isOpenAirMode("carpool")).toBe(false);
  });
});

describe("calculateCommuteEmissions", () => {
  it("computes car → metro for 10 km × 2 trips × 5 days", () => {
    const r = calculateCommuteEmissions({
      distanceKm: 10,
      tripsPerDay: 2,
      daysPerWeek: 5,
      currentMode: "car",
      alternativeMode: "metro",
    });
    expect(r.weeklyKm).toBe(100);
    expect(r.current.weeklyKg).toBe(16.2);
    expect(r.alternative.weeklyKg).toBe(2.4);
    expect(r.weeklySavingKg).toBe(13.8);
    expect(r.monthlySavingKg).toBeCloseTo(13.8 * WEEKS_PER_MONTH, 1);
    expect(r.monthlySavingKg).toBe(59.8);
    expect(r.yearlySavingKg).toBe(717.6);
    expect(r.current.perTripKg).toBe(1.62);
    expect(r.relativeChange).toBeCloseTo(-138 / 162, 5);
  });

  it("reports zero alternative emissions for walking and cycling", () => {
    const r = calculateCommuteEmissions({
      distanceKm: 3,
      tripsPerDay: 2,
      daysPerWeek: 6,
      currentMode: "two_wheeler",
      alternativeMode: "cycle",
    });
    expect(r.alternative.weeklyKg).toBe(0);
    expect(r.weeklySavingKg).toBe(2.34);
  });

  it("returns a negative saving when the alternative emits more", () => {
    const r = calculateCommuteEmissions({
      distanceKm: 5,
      tripsPerDay: 2,
      daysPerWeek: 5,
      currentMode: "metro",
      alternativeMode: "car",
    });
    expect(r.weeklySavingKg).toBeLessThan(0);
  });

  it("has no relative change when the current mode emits nothing", () => {
    const r = calculateCommuteEmissions({
      distanceKm: 2,
      tripsPerDay: 2,
      daysPerWeek: 5,
      currentMode: "walk",
      alternativeMode: "bus",
    });
    expect(r.relativeChange).toBeNull();
  });

  it("computes the per-km difference", () => {
    expect(savingPerKm("car", "metro")).toBe(138);
    expect(savingPerKm("bus", "car")).toBe(-134);
  });
});

describe("CommuteInputSchema", () => {
  const valid = {
    distanceKm: 10,
    tripsPerDay: 2,
    daysPerWeek: 5,
    currentMode: "car",
    alternativeMode: "bus",
  };
  it("accepts valid input", () => expect(CommuteInputSchema.safeParse(valid).success).toBe(true));
  it.each([
    [{ distanceKm: 0 }, "at least 0.1"],
    [{ distanceKm: 500 }, "200 km or less"],
    [{ tripsPerDay: 1.5 }, "whole number"],
    [{ daysPerWeek: 8 }, "At most 7"],
    [{ currentMode: "rocket" }, ""],
    [{ distanceKm: undefined }, "Enter a distance"],
  ])("rejects %o", (patch, message) => {
    const r = CommuteInputSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (message) expect(r.error?.issues[0]?.message).toContain(message);
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
