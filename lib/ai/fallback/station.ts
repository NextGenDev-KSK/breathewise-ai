import type { StationContext } from "@/lib/ai/schema";
import type { FormatTime } from "@/lib/time";

/**
 * One sentence on the nearest monitor for rule-based answers: its PM2.5 measurement and, when available,
 * its CPCB-method National AQI. Empty when there is no station data.
 */
export function stationSentence(station: StationContext | null, formatTime: FormatTime): string {
  if (!station) return "";
  const when = formatTime(station.measuredAt);
  const pm25 = station.readings.find((r) => r.pollutant === "PM2.5");
  const reading = pm25 ? `measured PM2.5 ${pm25.value} ${pm25.unit} at ${when}` : `last reported at ${when}`;
  const naqi = station.nationalAqi;
  const index = naqi
    ? `; its National AQI, calculated with the CPCB method from 24-hour averages, is ${naqi.aboveScale ? "401+" : naqi.index} (${naqi.category})`
    : "";
  const label = station.sample ? `${station.name} (sample capture)` : station.name;
  return ` The nearest official monitor, ${label}, ${station.distanceKm} km away, ${reading}${index}.`;
}
