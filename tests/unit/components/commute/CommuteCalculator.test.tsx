import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommuteCalculator } from "@/components/commute/CommuteCalculator";
import { renderWithApp, seedStorage } from "@/tests/fixtures/render";

describe("CommuteCalculator", () => {
  it("calculates the documented car → metro example", async () => {
    const user = userEvent.setup();
    seedStorage({ preferences: undefined });
    renderWithApp(<CommuteCalculator />);
    await user.selectOptions(screen.getByLabelText("Current transport"), "car");
    await user.selectOptions(screen.getByLabelText("Alternative to compare"), "metro");
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByTestId("weekly-saving")).toHaveTextContent("13.8 kg CO₂e");
    expect(screen.getByTestId("monthly-saving")).toHaveTextContent("59.8 kg CO₂e");
    expect(screen.getByText(/does not translate into a measurable change/)).toBeInTheDocument();
  });

  it("shows accessible field errors and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    renderWithApp(<CommuteCalculator />);
    const distance = screen.getByLabelText("One-way trip distance (km)");
    await user.clear(distance);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(distance).toHaveAttribute("aria-invalid", "true");
    expect(distance).toHaveAccessibleDescription(/Enter a distance in kilometres/);
    expect(distance).toHaveFocus();
    expect(screen.queryByTestId("weekly-saving")).not.toBeInTheDocument();
  });
});
