import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissionTracker } from "@/components/progress/MissionTracker";
import { renderWithApp } from "@/tests/fixtures/render";

describe("MissionTracker", () => {
  it("starts, ticks and resets a mission", async () => {
    const user = userEvent.setup();
    renderWithApp(<MissionTracker />);
    await user.click(await screen.findByRole("button", { name: "Start mission" }));
    await user.click(screen.getByRole("checkbox", { name: /Reduced indoor smoke sources/ }));
    expect(screen.getByText("1 of 7 done")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Actions completed each day" })).toHaveTextContent(
      /1 of 7 actions \(today\)/,
    );
    await user.click(screen.getByRole("button", { name: "Reset weekly challenge" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Reset your mission?" })).getByRole("button", {
        name: "Reset mission",
      }),
    );
    expect(screen.getByText("0 of 7 done")).toBeInTheDocument();
  });
});
