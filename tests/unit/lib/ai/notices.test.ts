import { describe, expect, it } from "vitest";
import { assistantModeLabel, FALLBACK_NOTICES } from "@/lib/ai/notices";
import { ASSISTANT_ERROR_CODES } from "@/lib/ai/schema";

describe("assistant notices", () => {
  it("has a user-facing notice for every server error code", () => {
    for (const code of ASSISTANT_ERROR_CODES) expect(FALLBACK_NOTICES[code].length).toBeGreaterThan(10);
  });
  it("labels the answering engine", () => {
    expect(assistantModeLabel({ aiEnabled: false, configured: true, hasData: true })).toMatch(/turned off/);
    expect(assistantModeLabel({ aiEnabled: true, configured: null, hasData: true })).toMatch(/Checking/);
    expect(assistantModeLabel({ aiEnabled: true, configured: false, hasData: true })).toMatch(
      /not configured/,
    );
    expect(assistantModeLabel({ aiEnabled: true, configured: true, hasData: false })).toMatch(
      /until a location/,
    );
    expect(assistantModeLabel({ aiEnabled: true, configured: true, hasData: true })).toBe(
      "Gemini AI, grounded in your local data",
    );
  });
});
