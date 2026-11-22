"use client";

import { RadioTower } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { NaqiPanel } from "@/components/stations/NaqiPanel";
import { StationReadings } from "@/components/stations/StationReadings";
import type { StationsState } from "@/hooks/useStations";
import { CPCB_URL } from "@/lib/content/notices";
import type { Station, StationReport } from "@/lib/stations/schema";
import { epochToLocalTime, formatAge, formatDay } from "@/lib/time";

const OPENAQ_URL = "https://openaq.org/";

/** Formats a UTC timestamp as the location's local clock time, e.g. "09:00". */
type FormatInstant = (iso: string) => string;

/** How to describe reading times: live data shows its age; the demo sample shows its capture date. */
interface TimeContext {
  fmt: FormatInstant;
  /** Formats a UTC timestamp as the location's local date, e.g. "Sun 22 Nov". */
  day: FormatInstant;
  nowMs: number;
  sample: boolean;
}

function StationLine({ station, time }: { station: Station; time: TimeContext }) {
  const when = time.sample
    ? `${time.day(station.lastUpdated)}, ${time.fmt(station.lastUpdated)}`
    : `${time.fmt(station.lastUpdated)} (${formatAge(Date.parse(station.lastUpdated), time.nowMs)})`;
  return (
    <>
      {station.provider} network · {station.distanceKm.toLocaleString("en-IN")} km away · last reading {when}
    </>
  );
}

function NearestStation({
  report,
  snapshot,
  time,
}: {
  report: StationReport & { nearest: NonNullable<StationReport["nearest"]> };
  snapshot: AirQualitySnapshot;
  time: TimeContext;
}) {
  const { station, readings, naqi } = report.nearest;
  const closest = report.stations[0];
  const others = report.stations.filter((s) => s.id !== station.id);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-ink text-base font-semibold">{station.name}</h3>
        <p className="text-ink-3 text-sm">
          <StationLine station={station} time={time} />
        </p>
        {closest && closest.id !== station.id ? (
          <p className="text-ink-3 mt-1 text-xs">
            Shown because it is the nearest monitor with enough data for the National AQI; {closest.name} (
            {closest.distanceKm} km) reports too few pollutants.
          </p>
        ) : null}
      </div>
      {naqi ? <NaqiPanel naqi={naqi} /> : null}
      <StationReadings readings={readings} snapshot={snapshot} />
      {others.length ? (
        <div>
          <h3 className="text-ink text-sm font-semibold">Other monitors nearby</h3>
          <ul className="text-ink-2 mt-1 space-y-0.5 text-sm">
            {others.map((s) => (
              <li key={s.id}>
                {s.name}: <StationLine station={s} time={time} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StationsBody({ stations, snapshot }: { stations: StationsState; snapshot: AirQualitySnapshot }) {
  const { nowMs, formatTime } = useApp();
  const local = (iso: string) => epochToLocalTime(Date.parse(iso), snapshot.utcOffsetSeconds);
  const fmt: FormatInstant = (iso) => formatTime(local(iso));
  const day: FormatInstant = (iso) => formatDay(local(iso));
  switch (stations.status) {
    case "idle":
    case "loading":
      return (
        <p role="status" className="text-ink-3 text-sm">
          Looking for monitoring stations near this location…
        </p>
      );
    case "error":
      return (
        <p className="text-ink-2 text-sm">{stations.message} The model estimate above is still available.</p>
      );
    case "success": {
      const { report } = stations;
      if (!report.nearest) {
        return (
          <p className="text-ink-2 text-sm">
            No official monitor within 25 km has reported in the last 3 hours. The model estimate above still
            covers this location.
          </p>
        );
      }
      const time: TimeContext = { fmt, day, nowMs, sample: stations.sample };
      return (
        <NearestStation report={{ ...report, nearest: report.nearest }} snapshot={snapshot} time={time} />
      );
    }
  }
}

/**
 * Measured readings from the nearest official monitors (CPCB and state boards in India, via OpenAQ),
 * with the CPCB National AQI where a station has the data for it. Complements the model forecast.
 */
export function StationsCard({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { stations } = useApp();
  const sample = stations.status === "success" && stations.sample;
  return (
    <Card>
      <CardHeader
        icon={<RadioTower className="size-4" />}
        title="Nearest monitoring stations"
        description="Hourly measurements from official monitors, the source of India's National AQI."
        action={sample ? <Badge tone="caution">Sample: real Delhi capture, 22 Nov 2026</Badge> : undefined}
      />
      <div className="space-y-4 p-5">
        <StationsBody stations={stations} snapshot={snapshot} />
        <p className="text-ink-3 text-xs">
          Data from{" "}
          <ExternalLink href={OPENAQ_URL} className="min-h-6 font-semibold">
            OpenAQ
          </ExternalLink>
          , which republishes CPCB and state pollution-control board stations. Official readings:{" "}
          <ExternalLink href={CPCB_URL} className="min-h-6 font-semibold">
            CPCB
          </ExternalLink>
          .
        </p>
      </div>
    </Card>
  );
}
