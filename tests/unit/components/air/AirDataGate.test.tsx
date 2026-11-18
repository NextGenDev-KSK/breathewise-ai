import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AirDataGate } from "@/components/air/AirDataGate";
import { renderWithApp, seedStorage } from "@/tests/fixtures/render";
import { DEFAULT_SETTINGS } from "@/types/preferences";

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
