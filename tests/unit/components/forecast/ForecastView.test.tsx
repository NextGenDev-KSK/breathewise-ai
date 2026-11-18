import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastView } from "@/components/forecast/ForecastView";
import { renderWithApp, seedDemoMode } from "@/tests/fixtures/render";

describe("ForecastView (sample data)", () => {
  it("finds a better outdoor window and switches the forecast measure", async () => {
    seedDemoMode();
    const user = userEvent.setup();
    renderWithApp(<ForecastView />);
    await user.click(await screen.findByText("Jogging"));
    await user.click(screen.getByRole("button", { name: "Find my better outdoor window" }));
    const result = screen.getByRole("region", { name: "Outdoor window result" });
    expect(result).toHaveTextContent(/better|poor/i);
    expect(result).not.toHaveTextContent(/\bsafe\b/i);
    await user.click(screen.getByText("US AQI", { selector: "label" }));
    expect(screen.getByRole("radio", { name: "US AQI" })).toBeChecked();
    expect(screen.getByRole("img", { name: /US AQI ranges from/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Daily forecast summary" })).toBeInTheDocument();
  });
});
