import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { DEFAULT_SETTINGS } from "@/types/preferences";
import { DELHI, delhiRaw } from "@/tests/fixtures/builders";
import { jsonResponse } from "@/tests/fixtures/http";
import { renderWithApp, seedDemoMode, seedStorage } from "@/tests/fixtures/render";

describe("DashboardView (sample data)", () => {
  it("shows the concern, both labelled indices, pollutants, actions and data confidence", async () => {
    seedDemoMode();
    renderWithApp(<DashboardView />);
    expect(await screen.findByText("Outdoor air concern:")).toBeInTheDocument();
    expect(screen.getByText("US AQI (US EPA)")).toBeInTheDocument();
    expect(screen.getByText("European AQI (EEA)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What to do today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pollutants now" })).toBeInTheDocument();
    expect(screen.getByText("Sample fixture for demonstration")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /PM2.5 ranges from/ })).toBeInTheDocument();
  });
});

describe("DashboardView (live data for an Indian city)", () => {
  it("explains that model values are not India's CPCB National AQI", async () => {
    seedStorage({ settings: { ...DEFAULT_SETTINGS, onboarded: true }, place: DELHI });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(delhiRaw)));
    renderWithApp(<DashboardView />);
    expect(
      await screen.findByRole("complementary", { name: "About India's National AQI" }),
    ).toBeInTheDocument();
  });

  it("does not show the CPCB notice for sample data", async () => {
    seedDemoMode();
    renderWithApp(<DashboardView />);
    await screen.findByText("Outdoor air concern:");
    expect(
      screen.queryByRole("complementary", { name: "About India's National AQI" }),
    ).not.toBeInTheDocument();
  });
});
