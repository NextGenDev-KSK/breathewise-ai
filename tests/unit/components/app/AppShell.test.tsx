import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/app/AppShell";
import { renderWithApp, seedStorage } from "@/tests/fixtures/render";
import { DEFAULT_SETTINGS } from "@/types/preferences";

describe("AppShell", () => {
  it("marks the current page and opens the mobile navigation drawer", async () => {
    seedStorage({ settings: { ...DEFAULT_SETTINGS, onboarded: true } });
    const user = userEvent.setup();
    renderWithApp(
      <AppShell>
        <h1>Page</h1>
      </AppShell>,
    );
    const current = screen.getAllByRole("link", { name: "Forecast" });
    expect(current[0]).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
  });

  it("shows the onboarding dialog on a first visit", async () => {
    renderWithApp(
      <AppShell>
        <h1>Page</h1>
      </AppShell>,
    );
    expect(await screen.findByRole("dialog", { name: "Welcome to BreatheWise AI" })).toBeInTheDocument();
  });
});
