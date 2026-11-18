import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationPicker } from "@/components/app/LocationPicker";
import { DataStatus } from "@/components/app/DataStatus";
import { Onboarding } from "@/components/app/Onboarding";
import { DemoBanner } from "@/components/app/DemoBanner";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { PlaceSchema } from "@/lib/air/snapshotSchema";
import { renderWithApp, seedStorage } from "../../fixtures/render";

function mockGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  });
}

afterEach(() => {
  // Remove the per-test geolocation mock so other tests see a browser without it.
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("Use my location", () => {
  it("stores a rounded location after the browser grants permission", async () => {
    mockGeolocation((ok) =>
      ok({ coords: { latitude: 28.613939, longitude: 77.209021 } } as GeolocationPosition),
    );
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText("Showing air quality for your approximate location.")).toBeInTheDocument();
    expect(readStored(STORAGE_KEYS.place, PlaceSchema.nullable(), null)).toMatchObject({
      latitude: 28.61,
      longitude: 77.21,
    });
  });

  it("explains a denied permission without storing anything", async () => {
    mockGeolocation((_ok, fail) => fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/permission was not granted/)).toBeInTheDocument();
    expect(readStored(STORAGE_KEYS.place, PlaceSchema.nullable(), null)).toBeNull();
  });

  it("handles browsers without geolocation", async () => {
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/does not support location detection/)).toBeInTheDocument();
  });
});

describe("DataStatus and DemoBanner", () => {
  it("labels sample data and lets the user leave demo mode", async () => {
    seedStorage({ settings: { ...DEFAULT_SETTINGS, demoMode: true, onboarded: true } });
    const user = userEvent.setup();
    renderWithApp(
      <>
        <DemoBanner />
        <DataStatus />
      </>,
    );
    expect(await screen.findByText("Sample data")).toBeInTheDocument();
    const banner = screen.getByRole("note", { name: "Demo mode" });
    expect(banner).toHaveTextContent("SAMPLE DATA · DEMO MODE");
    await user.click(within(banner).getByRole("button", { name: "Exit demo" }));
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS).demoMode).toBe(false);
  });
});

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
});
