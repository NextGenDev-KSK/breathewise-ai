import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ForecastView } from "@/components/forecast/ForecastView";
import { PlanView } from "@/components/plan/PlanView";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { MissionTracker } from "@/components/progress/MissionTracker";
import { AppShell } from "@/components/app/AppShell";
import { AirDataGate } from "@/components/air/AirDataGate";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SETTINGS,
  PreferencesSchema,
  SettingsSchema,
} from "@/types/preferences";
import { renderWithApp, seedStorage } from "../../fixtures/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/forecast", useRouter: () => ({ push }) }));

const demo = () => seedStorage({ settings: { ...DEFAULT_SETTINGS, demoMode: true, onboarded: true } });

beforeEach(() => {
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("DashboardView (sample data)", () => {
  it("shows the concern, both labelled indices, pollutants, actions and data confidence", async () => {
    demo();
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

describe("ForecastView (sample data)", () => {
  it("finds a better outdoor window and switches the forecast measure", async () => {
    demo();
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

describe("PlanView (sample data)", () => {
  it("shows all four periods and saves edited preferences", async () => {
    demo();
    const user = userEvent.setup();
    renderWithApp(<PlanView />);
    for (const period of ["Morning", "Afternoon", "Evening", "Night"]) {
      expect(
        await screen.findByRole("heading", { level: 3, name: new RegExp(`^${period}`) }),
      ).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Edit preferences" }));
    await user.click(screen.getByLabelText("Children"));
    await user.selectOptions(screen.getByLabelText("Usual commute"), "cycle");
    await user.click(screen.getByRole("button", { name: "Generate my clean-air day" }));
    expect(await screen.findByText("Your clean-air day plan has been updated.")).toBeInTheDocument();
    const saved = readStored(STORAGE_KEYS.preferences, PreferencesSchema, DEFAULT_PREFERENCES);
    expect(saved.household.children).toBe(true);
    expect(saved.commuteMode).toBe("cycle");
  });
});

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
    expect(push).toHaveBeenCalledWith("/");
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

describe("AirDataGate", () => {
  it("asks for a location when none is chosen", async () => {
    renderWithApp(<AirDataGate>{() => <p>data</p>}</AirDataGate>);
    expect(await screen.findByRole("heading", { name: "Choose a location to begin" })).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    seedStorage({
      settings: { ...DEFAULT_SETTINGS, onboarded: true },
      place: {
        id: "x",
        name: "Delhi",
        country: "India",
        countryCode: "IN",
        latitude: 28.6,
        longitude: 77.2,
        source: "search",
      },
    });
    renderWithApp(<AirDataGate>{() => <p>data</p>}</AirDataGate>);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Couldn't load air-quality data" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
