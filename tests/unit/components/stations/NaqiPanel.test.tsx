import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NaqiPanel } from "@/components/stations/NaqiPanel";
import { computeNaqi } from "@/lib/stations/naqi";

const day = (value: number) => Array.from({ length: 24 }, () => value);

describe("NaqiPanel", () => {
  it("shows the index, category, prominent pollutant and every sub-index", () => {
    render(<NaqiPanel naqi={computeNaqi({ pm2_5: day(45), nitrogen_dioxide: day(100), ozone: day(50) })} />);
    expect(screen.getAllByText("120")).toHaveLength(2); // overall index and the NO₂ sub-index
    expect(screen.getByText("Moderately polluted")).toBeInTheDocument();
    expect(screen.getByText("Prominent pollutant:")).toHaveTextContent("NO₂");
    expect(screen.getByRole("list", { name: "Sub-indices" })).toHaveTextContent("NO₂ 120PM2.5 75O₃ 50");
    expect(screen.getByText(/24-hour averages \(NO₂, PM2.5, O₃\)/)).toBeInTheDocument();
  });

  it("shows 401+ above the Severe threshold instead of an invented number", () => {
    render(<NaqiPanel naqi={computeNaqi({ pm2_5: day(300), pm10: day(200), ozone: day(40) })} />);
    expect(screen.getAllByText("401+")).toHaveLength(2); // overall and the PM2.5 sub-index
    expect(screen.getByText("Severe")).toBeInTheDocument();
  });

  it("explains why a station has no index", () => {
    render(<NaqiPanel naqi={computeNaqi({ pm2_5: day(45) })} />);
    expect(screen.getByText(/National AQI not available for this station/).closest("p")).toHaveTextContent(
      /this station has 1/,
    );
  });
});
