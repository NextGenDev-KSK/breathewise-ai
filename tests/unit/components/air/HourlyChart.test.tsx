import { describe, expect, it } from "vitest";
import { formatTime24 } from "@/lib/time";
import { summarizeSeries, HourlyChart } from "@/components/air/HourlyChart";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("summarizeSeries (regression)", () => {
  it("chart summaries treat a zero reading as data, not as missing", () => {
    const summary = summarizeSeries(
      [
        { time: "2026-11-17T06:00", value: 0, level: 0 },
        { time: "2026-11-17T07:00", value: 12, level: 1 },
      ],
      "PM2.5",
      formatTime24,
    );
    expect(summary).toBe("PM2.5 ranges from 0 (lowest at 06:00) to 12 (highest at 07:00) across 2 hours.");
  });
});

describe("HourlyChart", () => {
  const points = [
    { time: "2026-11-17T06:00", value: 80, level: 3 as const },
    { time: "2026-11-17T07:00", value: null, level: null },
    { time: "2026-11-17T08:00", value: 20, level: 1 as const },
  ];
  it("summarises the series in text, including missing hours", () => {
    expect(summarizeSeries(points, "PM2.5", (t) => t.slice(11))).toBe(
      "PM2.5 ranges from 20 (lowest at 08:00) to 80 (highest at 06:00) across 3 hours. 1 hours have no data.",
    );
  });
  it("exposes a summary as the chart's accessible name and an optional data table", async () => {
    const user = userEvent.setup();
    render(
      <HourlyChart
        points={points}
        label="PM2.5"
        unit="µg/m³"
        formatTime={(t) => t.slice(11)}
        title="PM2.5 test"
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/ranges from 20/);
    const toggle = screen.getByRole("button", { name: "Show data table" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const table = screen.getByRole("table", { name: "PM2.5 test" });
    expect(within(table).getByText("Not available")).toBeInTheDocument();
  });
});
