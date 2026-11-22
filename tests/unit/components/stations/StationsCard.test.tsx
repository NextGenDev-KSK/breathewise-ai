import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { StationsCard } from "@/components/stations/StationsCard";
import { DEMO_STATION_REPORT } from "@/lib/demo/stations";
import type { StationReport } from "@/lib/stations/schema";
import { DEFAULT_SETTINGS } from "@/types/preferences";
import { delhiSnapshot } from "@/tests/fixtures/ai";
import { DELHI } from "@/tests/fixtures/builders";
import { jsonResponse } from "@/tests/fixtures/http";
import { renderWithApp, seedDemoMode, seedStorage } from "@/tests/fixtures/render";

/** A live (non-demo) session for Delhi whose /api/stations answers with `response`. */
function liveWith(response: () => Promise<Response>) {
  seedStorage({ settings: { ...DEFAULT_SETTINGS, onboarded: true }, place: DELHI });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).startsWith("/api/stations") ? response() : new Response("", { status: 500 }),
    ),
  );
  renderWithApp(<StationsCard snapshot={delhiSnapshot()} />);
}

describe("StationsCard (demo sample)", () => {
  it("labels the sample and shows the station, its National AQI and readings in standard order", async () => {
    seedDemoMode();
    renderWithApp(<StationsCard snapshot={delhiSnapshot()} />);
    expect(await screen.findByText("Sample: real Delhi capture, 22 Nov 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lodhi Road, New Delhi - IMD" })).toBeInTheDocument();
    expect(screen.getByText(/2.6 km away · last reading Sun 22 Nov, 08:30/)).toBeInTheDocument();
    expect(screen.getByText("Moderately polluted")).toBeInTheDocument();
    const terms = screen.getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["PM2.5", "PM10", "O₃"]);
    expect(screen.getByText("80.5 µg/m³")).toBeInTheDocument();
    expect(screen.getByText(/Model estimate for this hour: PM2.5/)).toBeInTheDocument();
    const others = screen.getByRole("heading", { name: "Other monitors nearby" }).nextElementSibling;
    expect(within(others as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
  });

  it("credits OpenAQ and links to official CPCB readings", async () => {
    seedDemoMode();
    renderWithApp(<StationsCard snapshot={delhiSnapshot()} />);
    expect(await screen.findByRole("link", { name: /OpenAQ/ })).toHaveAttribute(
      "href",
      "https://openaq.org/",
    );
    expect(screen.getByRole("link", { name: /CPCB/ })).toHaveAttribute(
      "href",
      expect.stringContaining("cpcb.gov.in"),
    );
  });
});

describe("StationsCard (live)", () => {
  it("shows reading ages and explains when the index comes from a farther station", async () => {
    const closest = { ...DEMO_STATION_REPORT.stations[0]!, id: 1, name: "Closest Monitor", distanceKm: 0.8 };
    const report: StationReport = {
      ...DEMO_STATION_REPORT,
      stations: [closest, ...DEMO_STATION_REPORT.stations],
    };
    liveWith(async () => jsonResponse(report));
    expect(await screen.findByRole("heading", { name: "Lodhi Road, New Delhi - IMD" })).toBeInTheDocument();
    expect(screen.queryByText(/^Sample/)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/last reading \d{2}:\d{2} \((just now|\d+ (min|h|days) ago)\)/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/nearest monitor with enough data for the National AQI; Closest Monitor \(0.8 km\)/),
    ).toBeInTheDocument();
  });

  it("says when no official monitor has reported recently", async () => {
    liveWith(async () => jsonResponse({ ...DEMO_STATION_REPORT, stations: [], nearest: null }));
    expect(
      await screen.findByText(/No official monitor within 25 km has reported in the last 3 hours/),
    ).toBeInTheDocument();
  });

  it("explains a failure and points back to the model estimate", async () => {
    liveWith(async () =>
      jsonResponse(
        { error: "stations_not_configured", message: "Monitoring-station data is not configured." },
        503,
      ),
    );
    expect(
      await screen.findByText(
        "Monitoring-station data is not configured. The model estimate above is still available.",
      ),
    ).toBeInTheDocument();
  });

  it("announces that it is looking for stations while the request is in flight", async () => {
    liveWith(() => new Promise<Response>(() => undefined));
    // The toast region is also a status region, so find the message itself and check its role.
    expect(await screen.findByText("Looking for monitoring stations near this location…")).toHaveAttribute(
      "role",
      "status",
    );
  });
});
