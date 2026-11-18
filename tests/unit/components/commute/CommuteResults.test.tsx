import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommuteResults } from "@/components/commute/CommuteResults";
import { calculateCommuteEmissions, type CommuteInput } from "@/lib/engine/emissions";

const trip: CommuteInput = {
  distanceKm: 10,
  tripsPerDay: 2,
  daysPerWeek: 5,
  currentMode: "car",
  alternativeMode: "metro",
};

const renderResult = (patch: Partial<CommuteInput>) =>
  render(<CommuteResults result={calculateCommuteEmissions({ ...trip, ...patch })} />);

describe("CommuteResults", () => {
  it("labels a cleaner alternative as a saving and shows the relative change", () => {
    renderResult({});
    expect(screen.getByText("100 passenger-km per week.")).toBeInTheDocument();
    expect(screen.getByText("estimated saving")).toBeInTheDocument();
    expect(screen.getByTestId("monthly-saving")).not.toHaveTextContent("+");
    expect(screen.getByText(/^-\d+%$/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Weekly emissions comparison" })).toHaveTextContent(
      /Current: .*Alternative: /s,
    );
  });

  it("marks a dirtier alternative with + so it reads as more emissions", () => {
    renderResult({ currentMode: "metro", alternativeMode: "car" });
    expect(screen.getByText("more than current")).toBeInTheDocument();
    expect(screen.getByTestId("monthly-saving")).toHaveTextContent(/^\+/);
  });

  it("handles identical modes and zero-emission commutes without dividing by zero", () => {
    renderResult({ currentMode: "walk", alternativeMode: "walk" });
    expect(screen.getByText("no difference")).toBeInTheDocument();
    expect(screen.getByText("Not applicable")).toBeInTheDocument();
  });
});
