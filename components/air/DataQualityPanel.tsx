"use client";

import { Database } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { isIndianLocation, isStale } from "@/lib/engine/analysis";
import { formatAge, formatDay } from "@/lib/time";

/** Data-confidence summary: provider, type, time, availability and limitations. */
export function DataQualityPanel({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { nowMs, formatTime } = useApp();
  const stale = isStale(snapshot, nowMs);
  const available = Object.values(snapshot.current.pollutants).filter((v) => v !== null).length;
  const total = Object.keys(snapshot.current.pollutants).length;
  const forecastHours = snapshot.hourly.filter((h) => h.epochMs >= nowMs && h.pm2_5 !== null).length;

  const status =
    snapshot.origin === "demo"
      ? { tone: "caution" as const, text: "Sample data, not real" }
      : snapshot.origin === "cache"
        ? { tone: "caution" as const, text: "Saved copy" }
        : stale
          ? { tone: "caution" as const, text: "Older than 3 hours" }
          : { tone: "brand" as const, text: "Current model run" };

  const rows: [string, string][] = [
    ["Provider", snapshot.model.provider],
    ["Data type", snapshot.origin === "demo" ? "Sample fixture for demonstration" : "Model estimate and forecast (not a station measurement)"],
    ["Model", snapshot.model.name],
    ["Resolution", `${snapshot.model.spatialResolution}; ${snapshot.model.temporalResolution}`],
    ["Reading time", `${formatDay(snapshot.current.time)}, ${formatTime(snapshot.current.time)} local (${formatAge(snapshot.current.epochMs, nowMs)})`],
    ["Model updates", snapshot.model.updateFrequency],
    ["Availability", `${available} of ${total} pollutants now; ${forecastHours} forecast hours ahead`],
  ];

  const limitations = [
    "Grid-cell averages: conditions on your street, near traffic or indoors can be quite different.",
    snapshot.model.id === "cams_global" ? "The global model works in 3-hour steps; values between are interpolated." : null,
    isIndianLocation(snapshot) ? "Not India's CPCB National AQI. Check official station readings for regulatory values." : null,
    "Forecast accuracy decreases further ahead.",
  ].filter((x): x is string => x !== null);

  return (
    <Card>
      <CardHeader icon={<Database className="size-4" />} title="Data confidence" description="Where these numbers come from and how far to trust them." action={<Badge tone={status.tone}>{status.text}</Badge>} />
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <dl className="space-y-2.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="text-sm font-semibold text-ink">Known limitations</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
