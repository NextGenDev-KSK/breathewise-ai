import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommuteCalculator } from "@/components/commute/CommuteCalculator";
import { HourlyChart, summarizeSeries } from "@/components/air/HourlyChart";
import { LocationPicker } from "@/components/app/LocationPicker";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { IndoorView } from "@/components/indoor/IndoorView";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import { DEFAULT_SETTINGS } from "@/types/preferences";
import { renderWithApp, seedStorage } from "../../fixtures/render";
import pune from "../../fixtures/geocoding-pune.json";
import type { Recommendation } from "@/types/recommendation";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("CommuteCalculator", () => {
  it("calculates the documented car → metro example", async () => {
    const user = userEvent.setup();
    seedStorage({ preferences: undefined });
    renderWithApp(<CommuteCalculator />);
    await user.selectOptions(screen.getByLabelText("Current transport"), "car");
    await user.selectOptions(screen.getByLabelText("Alternative to compare"), "metro");
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByTestId("weekly-saving")).toHaveTextContent("13.8 kg CO₂e");
    expect(screen.getByTestId("monthly-saving")).toHaveTextContent("59.8 kg CO₂e");
    expect(screen.getByText(/does not translate into a measurable change/)).toBeInTheDocument();
  });

  it("shows accessible field errors and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    renderWithApp(<CommuteCalculator />);
    const distance = screen.getByLabelText("One-way trip distance (km)");
    await user.clear(distance);
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(distance).toHaveAttribute("aria-invalid", "true");
    expect(distance).toHaveAccessibleDescription(/Enter a distance in kilometres/);
    expect(distance).toHaveFocus();
    expect(screen.queryByTestId("weekly-saving")).not.toBeInTheDocument();
  });
});

describe("HourlyChart", () => {
  const points = [
    { time: "2026-11-17T06:00", value: 80, level: 3 as const },
    { time: "2026-11-17T07:00", value: null, level: null },
    { time: "2026-11-17T08:00", value: 20, level: 1 as const },
  ];
  it("summarises the series in text, including missing hours", () => {
    expect(summarizeSeries(points, "PM2.5", (t) => t.slice(11))).toBe("PM2.5 ranges from 20 (lowest at 08:00) to 80 (highest at 06:00) across 3 hours. 1 hours have no data.");
  });
  it("exposes a summary as the chart's accessible name and an optional data table", async () => {
    const user = userEvent.setup();
    render(<HourlyChart points={points} label="PM2.5" unit="µg/m³" formatTime={(t) => t.slice(11)} title="PM2.5 test" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/ranges from 20/);
    const toggle = screen.getByRole("button", { name: "Show data table" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const table = screen.getByRole("table", { name: "PM2.5 test" });
    expect(within(table).getByText("Not available")).toBeInTheDocument();
  });
});

describe("LocationPicker", () => {
  it("searches (debounced), supports keyboard selection and saves the place", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(pune), { status: 200 }));
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
    await waitFor(() => expect(JSON.parse(localStorage.getItem("breathewise:v1:place") ?? "null")?.name).toBe("Pune"));
    expect(await screen.findByText(/Showing air quality for Pune/)).toBeInTheDocument();
  });

  it("announces when there are no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    const user = userEvent.setup();
    renderWithApp(<LocationPicker />);
    await user.type(screen.getByRole("combobox"), "Zzzxq");
    expect(await screen.findByText("No matching locations found.")).toBeInTheDocument();
  });
});

describe("AssistantChat", () => {
  it("answers in rule-based mode when Gemini is not configured, and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (String(url).startsWith("/api/assistant") ? new Response(JSON.stringify({ configured: false })) : new Response("{}", { status: 500 }))),
    );
    seedStorage({ settings: { ...DEFAULT_SETTINGS, demoMode: true, onboarded: true } });
    const user = userEvent.setup();
    renderWithApp(<AssistantChat />);
    expect(await screen.findByText(/Rule-based mode: Gemini is not configured/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Is it a good time to go walking?" }));
    expect(await screen.findByText("Rule-based answer (no AI used)")).toBeInTheDocument();
    expect(screen.getByText(/Gemini is not configured on this server/)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE data/)).toBeInTheDocument();
  });

  it("validates input length and emptiness", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: false }))));
    const user = userEvent.setup();
    renderWithApp(<AssistantChat />);
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Please enter a question.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("IndoorView checklist", () => {
  it("persists checked items locally", async () => {
    seedStorage({ settings: { ...DEFAULT_SETTINGS, demoMode: true, onboarded: true } });
    const user = userEvent.setup();
    const { unmount } = renderWithApp(<IndoorView />);
    const box = await screen.findByRole("checkbox", { name: /Damp-dust surfaces/ });
    await user.click(box);
    expect(box).toBeChecked();
    expect(screen.getByText(/^1 of \d+ done$/)).toBeInTheDocument();
    unmount();
    renderWithApp(<IndoorView />);
    expect(await screen.findByRole("checkbox", { name: /Damp-dust surfaces/ })).toBeChecked();
  });
});

describe("RecommendationCard", () => {
  it("renders text safely and exposes the explanation", async () => {
    const rec: Recommendation = {
      id: "x",
      category: "outdoor",
      title: "<img src=x onerror=alert(1)>",
      description: "desc",
      reason: "because",
      evidence: ["US AQI: 152"],
      recommendedTime: "06:00–07:00",
      impactType: "exposure-reduction",
      confidence: "medium",
      source: "test",
      limitations: ["model"],
      priority: 1,
    };
    const user = userEvent.setup();
    const { container } = render(<RecommendationCard rec={rec} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    await user.click(screen.getByText("Why this recommendation?"));
    expect(screen.getByText("US AQI: 152")).toBeVisible();
    expect(screen.getByText("Confidence: medium")).toBeInTheDocument();
  });
});
