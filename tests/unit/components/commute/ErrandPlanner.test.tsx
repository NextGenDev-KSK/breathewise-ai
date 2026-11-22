import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrandPlanner } from "@/components/commute/ErrandPlanner";
import { renderWithApp } from "@/tests/fixtures/render";

async function setup() {
  const user = userEvent.setup();
  renderWithApp(<ErrandPlanner />);
  const estimate = () => user.click(screen.getByRole("button", { name: "Estimate saving" }));
  return { user, estimate };
}

describe("ErrandPlanner", () => {
  it("estimates the saving for the prefilled sample by car", async () => {
    const { user, estimate } = await setup();
    await user.selectOptions(screen.getByLabelText("Travel mode"), "car");
    await estimate();
    expect(screen.getByTestId("errand-saving")).toHaveTextContent(
      "Combining saves 8 km a week (34.7 km a month), about 5.62 kg CO₂e a month.",
    );
    expect(screen.getByText(/2 fewer departures from home/)).toBeInTheDocument();
  });

  it("says when combining saves no distance, and leaves out CO₂e on foot", async () => {
    const { user, estimate } = await setup();
    const combined = screen.getByLabelText("One combined trip (km)");
    await user.clear(combined);
    await user.type(combined, "30");
    await estimate();
    expect(screen.getByText(/combining saves no distance here/)).toBeInTheDocument();
    await user.clear(combined);
    await user.type(combined, "10");
    await user.selectOptions(screen.getByLabelText("Travel mode"), "walk");
    await estimate();
    expect(screen.getByTestId("errand-saving")).toHaveTextContent(
      "Combining saves 8 km a week (34.7 km a month).",
    );
  });

  it("announces invalid input on the field and moves focus to it", async () => {
    const { user, estimate } = await setup();
    const trips = screen.getByLabelText("Separate errand trips");
    await user.clear(trips);
    await user.type(trips, "1");
    await estimate();
    expect(trips).toHaveAttribute("aria-invalid", "true");
    expect(trips).toHaveFocus();
    expect(screen.getByText("Combining needs at least 2 trips.")).toBeInTheDocument();
    expect(screen.queryByTestId("errand-saving")).not.toBeInTheDocument();
  });
});
