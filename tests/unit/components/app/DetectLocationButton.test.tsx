import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationPicker } from "@/components/app/LocationPicker";
import { readStored, STORAGE_KEYS } from "@/lib/storage";
import { PlaceSchema } from "@/lib/air/snapshotSchema";
import { renderWithApp } from "@/tests/fixtures/render";

function mockGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  });
}

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
