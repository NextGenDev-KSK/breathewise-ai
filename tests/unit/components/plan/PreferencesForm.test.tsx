import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesForm } from "@/components/plan/PreferencesForm";
import { DEFAULT_PREFERENCES } from "@/types/preferences";

function setup() {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<PreferencesForm initial={DEFAULT_PREFERENCES} onSubmit={onSubmit} />);
  const submit = () => user.click(screen.getByRole("button", { name: "Generate my clean-air day" }));
  return { onSubmit, user, submit };
}

describe("PreferencesForm", () => {
  it("groups the questions into labelled fieldsets", () => {
    setup();
    for (const name of ["Routine", "Household (optional)", "Home equipment"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("submits every edited field: routine, times, household and equipment", async () => {
    const { onSubmit, user, submit } = setup();
    await user.selectOptions(screen.getByLabelText("Daily routine"), "student");
    await user.selectOptions(screen.getByLabelText("Usual commute"), "metro");
    fireEvent.change(screen.getByLabelText("Leave home at"), { target: { value: "07:30" } });
    fireEvent.change(screen.getByLabelText("Return home at"), { target: { value: "17:15" } });
    await user.selectOptions(screen.getByLabelText("Outdoor activity habit"), "cycling");
    await user.selectOptions(screen.getByLabelText("Preferred activity time"), "morning");
    await user.click(screen.getByLabelText("Children"));
    await user.click(screen.getByLabelText("Older adults"));
    await user.click(screen.getByLabelText("Someone sensitive to air pollution"));
    await user.click(screen.getByLabelText("Air purifier with HEPA filter"));
    await user.click(screen.getByLabelText("Kitchen exhaust vented outdoors"));
    await user.selectOptions(screen.getByLabelText("Main cooking fuel"), "biomass");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      routine: "student",
      commuteMode: "metro",
      leaveTime: "07:30",
      returnTime: "17:15",
      outdoorActivity: "cycling",
      preferredActivityTime: "morning",
      household: { children: true, olderAdults: true, respiratorySensitivity: true },
      equipment: { airPurifier: true, kitchenExhaust: true },
      cookingFuel: "biomass",
    });
  });

  it("blocks an invalid time, lists the problem, and clears it once fixed", async () => {
    const { onSubmit, submit } = setup();
    const leave = screen.getByLabelText("Leave home at");
    fireEvent.change(leave, { target: { value: "" } });
    await submit();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Please fix the following:");
    expect(alert).toHaveTextContent("leaveTime: Use HH:MM (24-hour) format");
    expect(screen.getByRole("button", { name: "Generate my clean-air day" }).closest("form")).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(leave, { target: { value: "08:00" } });
    await submit();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith({ ...DEFAULT_PREFERENCES, leaveTime: "08:00" });
  });
});
