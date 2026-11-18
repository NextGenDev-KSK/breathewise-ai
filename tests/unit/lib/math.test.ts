import { describe, expect, it } from "vitest";
import { maxBy, mean, minBy, presentValues, roundTo } from "@/lib/math";

describe("math helpers", () => {
  it("computes means and rounding", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNull();
    expect(roundTo(86.649, 1)).toBe(86.6);
    expect(roundTo(152.5)).toBe(153);
  });
  it("drops missing values without treating them as zero", () => {
    expect(presentValues([3, null, 0, null])).toEqual([3, 0]);
  });
  it("finds extremes, skipping nulls and keeping the earliest tie", () => {
    const items = [{ v: 5 }, { v: null }, { v: 2 }, { v: 2 }, { v: 9 }];
    expect(minBy(items, (i) => i.v)).toBe(items[2]);
    expect(maxBy(items, (i) => i.v)).toBe(items[4]);
    expect(minBy([{ v: null }], (i) => i.v)).toBeNull();
    expect(maxBy([], () => 1)).toBeNull();
  });
});
