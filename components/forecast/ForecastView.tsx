"use client";

import { useMemo, useState } from "react";
import { CalendarDays, LineChart } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { AirDataGate } from "@/components/air/AirDataGate";
import { HourlyChart } from "@/components/air/HourlyChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { cn } from "@/components/ui/cn";
import { OutdoorWindowPlanner } from "@/components/forecast/OutdoorWindowPlanner";
import { buildSeries, levelFor, SERIES_META, summarizeDays, type SeriesMetric } from "@/lib/air/series";
import { upcomingHours } from "@/lib/engine/analysis";
import { relativeDayLabel, epochToLocalTime } from "@/lib/time";

const METRICS: SeriesMetric[] = ["pm2_5", "pm10", "us_aqi", "european_aqi"];

function Forecast({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { nowMs, formatTime } = useApp();
  const [metric, setMetric] = useState<SeriesMetric>("pm2_5");
  const next24 = useMemo(() => upcomingHours(snapshot, nowMs, 24), [snapshot, nowMs]);
  const series = useMemo(() => buildSeries(next24, metric), [next24, metric]);
  const days = useMemo(() => summarizeDays(snapshot.hourly.filter((h) => h.epochMs >= nowMs - 3_600_000)), [snapshot, nowMs]);
  const nowLocal = epochToLocalTime(nowMs, snapshot.utcOffsetSeconds);
  const meta = SERIES_META[metric];
  const available = series.some((p) => p.value !== null);

  return (
    <div className="space-y-6">
      <OutdoorWindowPlanner snapshot={snapshot} />

      <Card>
        <CardHeader icon={<LineChart className="size-4" />} title="Next 24 hours" description={`Hourly ${snapshot.model.temporalResolution.startsWith("3") ? "values (model runs in 3-hour steps)" : "model forecast"}.`} />
        <div className="p-5">
          <div role="radiogroup" aria-label="Forecast measure" className="mb-4 inline-flex flex-wrap gap-1 rounded-xl bg-canvas p-1">
            {METRICS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                onClick={() => setMetric(m)}
                className={cn("min-h-10 rounded-lg px-3 text-sm font-semibold", metric === m ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
              >
                {SERIES_META[m].label}
              </button>
            ))}
          </div>
          {available ? (
            <HourlyChart points={series} label={meta.label} unit={meta.unit} formatTime={formatTime} title={`${meta.label} forecast for the next 24 hours`} />
          ) : (
            <p className="rounded-lg bg-canvas p-4 text-sm text-ink-2">{meta.label} is not available in the forecast for this location.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader icon={<CalendarDays className="size-4" />} title="Multi-day overview" description={`Daily PM2.5 range and peak index values. Forecast length: ${snapshot.model.forecastLength}.`} />
        <div className="overflow-x-auto p-2 sm:p-4" tabIndex={0} role="region" aria-label="Daily forecast summary (scrollable)">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Daily forecast summary</caption>
            <thead className="text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th scope="col" className="px-3 py-2">Day</th>
                <th scope="col" className="px-3 py-2">PM2.5 range (µg/m³)</th>
                <th scope="col" className="px-3 py-2">Daily mean</th>
                <th scope="col" className="px-3 py-2">Peak US AQI</th>
                <th scope="col" className="px-3 py-2">Peak EU AQI</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                    {relativeDayLabel(d.firstTime, nowLocal)}
                    {d.hours < 24 ? <span className="block text-xs font-normal text-ink-3">{d.hours} hours remaining</span> : null}
                  </th>
                  <td className="tabular px-3 py-2.5">{d.pm25 ? `${Math.round(d.pm25.min)}–${Math.round(d.pm25.max)}` : "Not available"}</td>
                  <td className="px-3 py-2.5">
                    {d.pm25 ? (
                      <span className="flex items-center gap-2">
                        <span className="tabular">{Math.round(d.pm25.mean)}</span>
                        <LevelBadge level={levelFor("pm2_5", d.pm25.mean)} />
                      </span>
                    ) : (
                      "Not available"
                    )}
                  </td>
                  <td className="tabular px-3 py-2.5">{d.usAqiMax === null ? "Not available" : Math.round(d.usAqiMax)}</td>
                  <td className="tabular px-3 py-2.5">{d.europeanAqiMax === null ? "Not available" : Math.round(d.europeanAqiMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 pt-3 text-xs text-ink-3">
            Concern level for the daily mean uses US EPA PM2.5 breakpoints. These are model forecasts; accuracy decreases with lead time.
          </p>
        </div>
      </Card>
    </div>
  );
}

export function ForecastView() {
  return <AirDataGate>{(s) => <Forecast snapshot={s} />}</AirDataGate>;
}
