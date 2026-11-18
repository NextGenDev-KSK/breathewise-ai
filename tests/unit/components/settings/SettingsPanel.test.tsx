import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { router } from "@/tests/fixtures/navigation";
import { renderWithApp, seedStorage } from "@/tests/fixtures/render";

describe("SettingsPanel", () => {
  it("changes behaviour-affecting settings and clears all local data after confirmation", async () => {
    seedStorage({ settings: { ...DEFAULT_SETTINGS, onboarded: true } });
    const user = userEvent.setup();
    renderWithApp(<SettingsPanel />);
    await user.click(screen.getByText("12-hour"));
    await user.click(screen.getByText("European AQI (EEA)"));
    await user.click(screen.getByRole("switch", { name: "Use AI (Gemini) for assistant answers" }));
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS)).toMatchObject({
      timeFormat: "12h",
      aqiStandard: "eu",
      aiEnabled: false,
    });
    await user.click(screen.getByRole("button", { name: "Clear all local data" }));
    const dialog = screen.getByRole("dialog", { name: "Clear all local data?" });
    await user.click(within(dialog).getByRole("button", { name: "Clear data" }));
    expect(localStorage.getItem("breathewise:v1:settings")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/");
    expect(await screen.findByText("All local data was cleared from this browser.")).toBeInTheDocument();
  });

  it("names every data source with safe external links", () => {
    renderWithApp(<SettingsPanel />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("(opens in a new tab)");
    }
  });
});
