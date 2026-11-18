import { describe, expect, it } from "vitest";
import { buildDemoSnapshot } from "@/lib/demo/fixture";

describe("demo fixture", () => {
  it("is explicitly labelled as sample data", () => {
    const s = buildDemoSnapshot(Date.UTC(2026, 10, 17, 6));
    expect(s.origin).toBe("demo");
    expect(s.model.id).toBe("sample");
    expect(s.place.name).toBe("Sample City");
    expect(s.hourly).toHaveLength(72);
    expect(s.current.epochMs).toBeLessThanOrEqual(Date.UTC(2026, 10, 17, 6));
  });
});
