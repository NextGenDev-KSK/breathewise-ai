"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { concernLevelFor } from "@/lib/air/indices";
import { summarizeDays, type DaySummary } from "@/lib/air/series";
import { epochToLocalTime, HOUR_MS, relativeDayLabel } from "@/lib/time";

const NOT_AVAILABLE = "Not available";
const COLUMNS = ["Day", "PM2.5 range (µg/m³)", "Daily mean", "Peak US AQI", "Peak EU AQI"];

function DayRow({ day, nowLocal }: { day: DaySummary; nowLocal: string }) {
  const { pm25 } = day;
  return (
    <tr className="border-line border-t">
      <th scope="row" className="text-ink px-3 py-2.5 font-semibold">
        {relativeDayLabel(day.firstTime, nowLocal)}
        {day.hours < 24 ? (
          <span className="text-ink-3 block text-xs font-normal">{day.hours} hours remaining</span>
        ) : null}
      </th>
      <td className="tabular px-3 py-2.5">
        {pm25 ? `${Math.round(pm25.min)}–${Math.round(pm25.max)}` : NOT_AVAILABLE}
      </td>
      <td className="px-3 py-2.5">
        {pm25 ? (
          <span className="flex items-center gap-2">
            <span className="tabular">{Math.round(pm25.mean)}</span>
            <LevelBadge level={concernLevelFor("pm2_5", pm25.mean)} />
          </span>
        ) : (
          NOT_AVAILABLE
        )}
      </td>
      <td className="tabular px-3 py-2.5">
        {day.usAqiMax === null ? NOT_AVAILABLE : Math.round(day.usAqiMax)}
      </td>
      <td className="tabular px-3 py-2.5">
        {day.europeanAqiMax === null ? NOT_AVAILABLE : Math.round(day.europeanAqiMax)}
      </td>
    </tr>
  );
}

/** One row per forecast day: PM2.5 range, mean with its concern level, and peak index values. */
export function DailyOverview({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { nowMs } = useApp();
  const days = useMemo(
    () => summarizeDays(snapshot.hourly.filter((h) => h.epochMs >= nowMs - HOUR_MS)),
    [snapshot, nowMs],
  );
  const nowLocal = epochToLocalTime(nowMs, snapshot.utcOffsetSeconds);

  return (
    <Card>
      <CardHeader
        icon={<CalendarDays className="size-4" />}
        title="Multi-day overview"
        description={`Daily PM2.5 range and peak index values. Forecast length: ${snapshot.model.forecastLength}.`}
      />
      <div
        className="overflow-x-auto p-2 sm:p-4"
        tabIndex={0}
        role="region"
        aria-label="Daily forecast summary (scrollable)"
      >
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Daily forecast summary</caption>
          <thead className="text-ink-3 text-xs tracking-wide uppercase">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-3 py-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <DayRow key={day.date} day={day} nowLocal={nowLocal} />
            ))}
          </tbody>
        </table>
        <p className="text-ink-3 px-3 pt-3 text-xs">
          Concern level for the daily mean uses US EPA PM2.5 breakpoints. These are model forecasts; accuracy
          decreases with lead time.
        </p>
      </div>
    </Card>
  );
}
