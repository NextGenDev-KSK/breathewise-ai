import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanView } from "@/components/plan/PlanView";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_PREFERENCES, PreferencesSchema } from "@/types/preferences";
import { renderWithApp, seedDemoMode } from "@/tests/fixtures/render";

describe("PlanView (sample data)", () => {
  it("shows all four periods and saves edited preferences", async () => {
    seedDemoMode();
    const user = userEvent.setup();
    renderWithApp(<PlanView />);
    for (const period of ["Morning", "Afternoon", "Evening", "Night"]) {
      expect(
        await screen.findByRole("heading", { level: 3, name: new RegExp(`^${period}`) }),
      ).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    await user.click(screen.getByLabelText("Children"));
    await user.selectOptions(screen.getByLabelText("Usual commute"), "cycle");
    await user.click(screen.getByRole("button", { name: "Generate my clean-air day" }));
    expect(await screen.findByText("Your clean-air day plan has been updated.")).toBeInTheDocument();
    const saved = readStored(STORAGE_KEYS.preferences, PreferencesSchema, DEFAULT_PREFERENCES);
    expect(saved.household.children).toBe(true);
    expect(saved.commuteMode).toBe("cycle");
  });
});
