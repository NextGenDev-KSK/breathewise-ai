import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationPicker } from "@/components/app/LocationPicker";
import { renderWithApp } from "@/tests/fixtures/render";
import pune from "@/tests/fixtures/geocoding-pune.json";
import { jsonResponse } from "@/tests/fixtures/http";

describe("LocationPicker", () => {
  it("searches (debounced), supports keyboard selection and saves the place", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pune, 200));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    const input = screen.getByRole("combobox", { name: "Search for a city" });
    await user.type(input, "Pune");
    const option = await screen.findByRole("option", { name: "Pune, Maharashtra, India" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // typing 4 characters triggered one debounced request
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(option).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("breathewise:v1:place") ?? "null")?.name).toBe("Pune"),
    );
    expect(await screen.findByText(/Showing air quality for Pune/)).toBeInTheDocument();
  });

  it("announces when there are no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 200)));
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.type(screen.getByRole("combobox"), "Zzzxq");
    expect(await screen.findByText("No matching locations found.")).toBeInTheDocument();
  });

  it("lets mouse users hover to highlight and click to choose", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(pune)));
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.type(screen.getByRole("combobox", { name: "Search for a city" }), "Pune");
    const options = await screen.findAllByRole("option");
    const last = options.at(-1);
    if (!last) throw new Error("expected search results");
    await user.hover(last);
    expect(last).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Pune, Maharashtra, India" }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("breathewise:v1:place") ?? "null")?.name).toBe("Pune"),
    );
  });

  it("says search is unavailable when the geocoding service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.type(screen.getByRole("combobox"), "Pune");
    expect(await screen.findByText(/Search is unavailable/)).toBeInTheDocument();
  });
});
