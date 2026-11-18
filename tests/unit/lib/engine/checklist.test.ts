import { describe, expect, it } from "vitest";
import { completedToday, EMPTY_CHECKLIST_PROGRESS, toggleChecklistItem } from "@/lib/engine/checklist";

describe("daily indoor checklist", () => {
  it("ticks and unticks items for today", () => {
    let progress = toggleChecklistItem(EMPTY_CHECKLIST_PROGRESS, "dust-mop", "2026-11-17");
    expect([...completedToday(progress, "2026-11-17")]).toEqual(["dust-mop"]);
    progress = toggleChecklistItem(progress, "dust-mop", "2026-11-17");
    expect(completedToday(progress, "2026-11-17").size).toBe(0);
  });
  it("starts fresh on a new day", () => {
    const yesterday = toggleChecklistItem(EMPTY_CHECKLIST_PROGRESS, "src-smoke", "2026-11-16");
    expect(completedToday(yesterday, "2026-11-17").size).toBe(0);
    expect(toggleChecklistItem(yesterday, "dust-mop", "2026-11-17")).toEqual({
      date: "2026-11-17",
      done: ["dust-mop"],
    });
  });
});
