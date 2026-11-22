import { describe, expect, it } from "vitest";
import { stationSentence } from "@/lib/ai/fallback/station";
import { stationContextFrom } from "@/lib/ai/context";
import { DEMO_STATION_REPORT } from "@/lib/demo/stations";
import { formatTime24 } from "@/lib/time";

const station = stationContextFrom(DEMO_STATION_REPORT, { sample: false, utcOffsetSeconds: 19_800 });

describe("stationSentence", () => {
  it("names the monitor, its distance, the PM2.5 measurement and the CPCB-method index", () => {
    expect(stationSentence(station, formatTime24)).toBe(
      " The nearest official monitor, Lodhi Road, New Delhi - IMD, 2.6 km away, measured PM2.5 80.5 µg/m³ at 08:30; its National AQI, calculated with the CPCB method from 24-hour averages, is 141 (Moderately polluted).",
    );
  });

  it("labels the demo capture and copes with missing PM2.5 or index", () => {
    if (!station) throw new Error("expected station context");
    const sparse = {
      ...station,
      sample: true,
      nationalAqi: null,
      readings: station.readings.filter((r) => r.pollutant !== "PM2.5"),
    };
    expect(stationSentence(sparse, formatTime24)).toBe(
      " The nearest official monitor, Lodhi Road, New Delhi - IMD (sample capture), 2.6 km away, last reported at 08:30.",
    );
    expect(
      stationSentence(
        { ...station, nationalAqi: station.nationalAqi && { ...station.nationalAqi, aboveScale: true } },
        formatTime24,
      ),
    ).toContain("is 401+");
  });

  it("is empty without station data", () => {
    expect(stationSentence(null, formatTime24)).toBe("");
  });
});
