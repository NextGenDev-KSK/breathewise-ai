import { describe, expect, it } from "vitest";
import { HOUR_MS, MINUTE_MS } from "@/lib/time";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataStatus, dataStatus } from "@/components/app/DataStatus";
import { makeSnapshot } from "@/tests/fixtures/builders";
import { DemoBanner } from "@/components/app/DemoBanner";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { renderWithApp, seedDemoMode } from "@/tests/fixtures/render";

describe("DataStatus and DemoBanner", () => {
  it("labels sample data and lets the user leave demo mode", async () => {
    seedDemoMode();
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

describe("dataStatus", () => {
  const at = (origin: "live" | "cache" | "demo") => makeSnapshot({ pm25: [40, 40, 40, 40], origin });

  it("labels sample data and saved copies with a caution tone", () => {
    const demo = at("demo");
    expect(dataStatus(demo.snapshot, demo.nowMs)).toMatchObject({ label: "Sample data" });
    const saved = at("cache");
    const status = dataStatus(saved.snapshot, saved.snapshot.fetchedAt + 30 * MINUTE_MS);
    expect(status.label).toBe("Saved copy · 30 min ago");
    expect(status.tone).toMatch(/caution/);
  });

  it("shows when live data was updated, and warns once the current hour is stale", () => {
    const live = at("live");
    const fresh = dataStatus(live.snapshot, live.snapshot.fetchedAt + 5 * MINUTE_MS);
    expect(fresh.label).toBe("Model data · updated 5 min ago");
    expect(fresh.tone).toMatch(/brand/);
    const stale = dataStatus(live.snapshot, live.snapshot.current.epochMs + 5 * HOUR_MS);
    expect(stale.label).toBe("Model data · 5 h ago");
    expect(stale.tone).toMatch(/caution/);
  });
});
