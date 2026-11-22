import { describe, expect, it } from "vitest";
import { combineErrands, parseErrandForm, type ErrandFormValues } from "@/lib/engine/errands";

const sample: ErrandFormValues = {
  trips: "3",
  roundTripKm: "6",
  combinedKm: "10",
  timesPerWeek: "1",
  mode: "car",
};

describe("combineErrands", () => {
  it("compares separate round trips with one combined trip (the README sample)", () => {
    const parsed = parseErrandForm(sample);
    if (!parsed.ok) throw new Error("sample should be valid");
    expect(combineErrands(parsed.input)).toEqual({
      separateKmWeek: 18, // 3 trips × 6 km
      combinedKmWeek: 10,
      savedKmWeek: 8,
      savedKmMonth: 34.7, // 8 × 52 / 12
      savedKgWeek: 1.3, // 8 km × 162 g
      savedKgMonth: 5.62,
      tripsAvoidedWeek: 2,
    });
  });

  it("scales with how often the errands are run and uses the mode's factor", () => {
    const result = combineErrands({
      trips: 4,
      roundTripKm: 5,
      combinedKm: 12,
      timesPerWeek: 2,
      mode: "two_wheeler",
    });
    expect(result).toMatchObject({
      separateKmWeek: 40,
      combinedKmWeek: 24,
      savedKmWeek: 16,
      tripsAvoidedWeek: 6,
    });
    expect(result.savedKgWeek).toBe(1.04); // 16 km × 65 g
  });

  it("reports no saving when the combined trip is not shorter, and zero CO₂e on foot", () => {
    expect(
      combineErrands({ trips: 2, roundTripKm: 3, combinedKm: 8, timesPerWeek: 1, mode: "car" }).savedKmWeek,
    ).toBe(-2);
    expect(
      combineErrands({ trips: 3, roundTripKm: 2, combinedKm: 4, timesPerWeek: 1, mode: "walk" }).savedKgWeek,
    ).toBe(0);
  });
});

describe("parseErrandForm", () => {
  it("returns one clear message per invalid field", () => {
    const result = parseErrandForm({
      ...sample,
      trips: "1",
      roundTripKm: "",
      combinedKm: "500",
      timesPerWeek: "1.5",
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        trips: "Combining needs at least 2 trips.",
        roundTripKm: "Enter the round-trip distance of a typical errand.",
        combinedKm: "At most 300 km.",
        timesPerWeek: "Use a whole number.",
      },
    });
  });
});
