import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CadrHelper } from "@/components/indoor/CadrHelper";

describe("CadrHelper", () => {
  it("suggests a minimum CADR for the default 12 m² room", () => {
    render(<CadrHelper />);
    expect(screen.getByText(/at least about \d+ cfm .* for 12 m²/)).toBeInTheDocument();
  });

  it("prompts for an area when empty and flags out-of-range values", async () => {
    const user = userEvent.setup();
    render(<CadrHelper />);
    const input = screen.getByLabelText("Room floor area (m²)");
    await user.clear(input);
    expect(screen.getByText("Enter a room area to see a suggested minimum.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
    await user.type(input, "900");
    expect(screen.getByText("Enter an area between 1 and 500 m².")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter an area between 1 and 500 m².");
  });
});
