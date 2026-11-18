import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Onboarding } from "@/components/app/Onboarding";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { renderWithApp } from "@/tests/fixtures/render";

describe("Onboarding", () => {
  it("can start demo mode and is not shown again", async () => {
    const user = userEvent.setup();
    renderWithApp(<Onboarding />);
    const dialog = await screen.findByRole("dialog", { name: "Welcome to BreatheWise AI" });
    await user.click(within(dialog).getByRole("button", { name: "Try demo" }));
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS)).toMatchObject({
      demoMode: true,
      onboarded: true,
    });
  });

  it("moves focus to city search when the user chooses to search", async () => {
    const user = userEvent.setup();
    renderWithApp(
      <>
        <input id="location-search" aria-label="Search for a city" />
        <Onboarding />
      </>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Welcome to BreatheWise AI" });
    await user.click(within(dialog).getByRole("button", { name: "Search city" }));
    await waitFor(() => expect(screen.getByLabelText("Search for a city")).toHaveFocus());
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS).onboarded).toBe(true);
  });

  it("asks the browser for location when the user chooses My location", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    const user = userEvent.setup();
    renderWithApp(<Onboarding />);
    const dialog = await screen.findByRole("dialog", { name: "Welcome to BreatheWise AI" });
    await user.click(within(dialog).getByRole("button", { name: "My location" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS).onboarded).toBe(true);
  });

  it("counts closing the dialog (Escape) as finishing onboarding", async () => {
    renderWithApp(<Onboarding />);
    const dialog = await screen.findByRole("dialog", { name: "Welcome to BreatheWise AI" });
    // Browsers turn Escape on a modal <dialog> into a cancelable "cancel" event; jsdom does not.
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() =>
      expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS).onboarded).toBe(true),
    );
  });
});
