import type { AirQualitySnapshot } from "@/types/air";
import { NAQI_POLLUTANTS, NAQI_RULES } from "@/lib/stations/naqi";
import type { StationReading } from "@/lib/stations/schema";
import { formatConcentration } from "@/lib/air/pollutants";

function formatValue({ value, unit }: StationReading): string {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: unit === "mg/m³" ? 2 : 1 })} ${unit}`;
}

/** Latest hourly value of each pollutant at the station, with the model's estimate for PM2.5 beside it. */
export function StationReadings({
  readings,
  snapshot,
}: {
  readings: readonly StationReading[];
  snapshot: AirQualitySnapshot;
}) {
  const modelPm25 = snapshot.current.pollutants.pm2_5;
  const stationPm25 = readings.find((r) => r.pollutant === "pm2_5");
  const ordered = [...readings].sort(
    (a, b) => NAQI_POLLUTANTS.indexOf(a.pollutant) - NAQI_POLLUTANTS.indexOf(b.pollutant),
  );
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ordered.map((reading) => (
          <div key={reading.pollutant} className="border-line rounded-xl border px-3 py-2">
            <dt className="text-ink-3 text-xs font-semibold">{NAQI_RULES[reading.pollutant].label}</dt>
            <dd className="tabular text-ink mt-0.5 font-semibold">{formatValue(reading)}</dd>
          </div>
        ))}
      </dl>
      {stationPm25 && modelPm25 !== null ? (
        <p className="text-ink-3 mt-3 text-xs">
          Model estimate for this hour: PM2.5 {formatConcentration(modelPm25, "pm2_5")}. A station measures
          one spot, while the model averages a grid of several kilometres, so the two can differ.
        </p>
      ) : null}
    </div>
  );
}
