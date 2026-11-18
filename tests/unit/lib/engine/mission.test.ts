import { describe, expect, it } from "vitest";
import {
  daysBetween,
  missionDayIndex,
  missionProgress,
  newMission,
  toggleAction,
  todayIso,
  MissionStateSchema,
} from "@/lib/engine/mission";

describe("7-day mission", () => {
  it("tracks days, toggles and progress", () => {
    let m = newMission("2026-11-10");
    expect(missionDayIndex(m, "2026-11-10")).toBe(0);
    expect(missionDayIndex(m, "2026-11-16")).toBe(6);
    expect(missionDayIndex(m, "2026-11-17")).toBeNull();
    m = toggleAction(m, 0, "no-smoke");
    m = toggleAction(m, 1, "no-smoke");
    m = toggleAction(m, 1, "dust");
    m = toggleAction(m, 2, "dust");
    m = toggleAction(m, 2, "dust"); // untoggle
    const p = missionProgress(m, "2026-11-12");
    expect(p.totalCompleted).toBe(3);
    expect(p.perAction["no-smoke"]).toBe(2);
    expect(p.activeDays).toBe(2);
    expect(p.streak).toBe(2); // day 2 (today) not started yet does not break it
    expect(p.percent).toBe(Math.round((3 / 49) * 100));
    expect(MissionStateSchema.safeParse(m).success).toBe(true);
  });

  it("ignores out-of-range days", () => {
    const m = newMission("2026-11-10");
    expect(toggleAction(m, 7, "dust")).toBe(m);
  });

  it("computes dates", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
