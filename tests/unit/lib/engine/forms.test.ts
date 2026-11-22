import { describe, expect, it } from "vitest";
import { z } from "zod";
import { firstErrorPerField, numberOrUndefined } from "@/lib/engine/forms";

describe("form helpers", () => {
  it("treats blank text as not entered and parses anything else as a number", () => {
    expect(numberOrUndefined("  ")).toBeUndefined();
    expect(numberOrUndefined("4.5")).toBe(4.5);
    expect(numberOrUndefined("abc")).toBeNaN();
  });

  it("keeps only the first message for each known field", () => {
    const schema = z.object({
      a: z.number().min(5, "too small").int("whole"),
      b: z.string().min(2, "short"),
    });
    const result = schema.safeParse({ a: 1.5, b: "x", c: 1 });
    if (result.success) throw new Error("expected failure");
    expect(firstErrorPerField(result.error.issues, ["a"] as const)).toEqual({ a: "too small" });
  });
});
