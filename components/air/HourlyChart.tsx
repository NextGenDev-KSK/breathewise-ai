"use client";

import { useId, useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import type { SeriesPoint } from "@/lib/air/series";
import { maxBy, minBy } from "@/lib/math";
import type { FormatTime } from "@/lib/time";
import { ChartDataTable } from "@/components/air/chart/ChartDataTable";
import { ChartLegend } from "@/components/air/chart/ChartLegend";
import { ChartPlot } from "@/components/air/chart/ChartPlot";
import { chartGeometry } from "@/components/air/chart/geometry";

/** Builds the plain-language summary that serves as the chart's text alternative. */
export function summarizeSeries(points: SeriesPoint[], label: string, fmt: FormatTime): string {
  const lowest = minBy(points, (p) => p.value);
  const highest = maxBy(points, (p) => p.value);
  const low = lowest?.value ?? null;
  const high = highest?.value ?? null;
  // A reading of 0 is valid data; only null means "missing".
  if (!lowest || !highest || low === null || high === null) {
    return `No ${label} forecast values are available for this period.`;
  }
  const missing = points.filter((p) => p.value === null).length;
  const gaps = missing ? ` ${missing} hours have no data.` : "";
  return `${label} ranges from ${Math.round(low)} (lowest at ${fmt(lowest.time)}) to ${Math.round(high)} (highest at ${fmt(highest.time)}) across ${points.length} hours.${gaps}`;
}

interface HourlyChartProps {
  points: SeriesPoint[];
  label: string;
  unit: string;
  formatTime: FormatTime;
  title: string;
}

/**
 * Hourly bar chart with three equivalent views: the visual chart, a plain-language summary
 * (its accessible name), and an optional data table.
 */
export function HourlyChart({ points, label, unit, formatTime, title }: HourlyChartProps) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const tableId = useId();
  const geometry = useMemo(() => chartGeometry(points), [points]);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      {/* Keeps axis labels legible on phones; the chart scrolls inside its card, never the page. */}
      <div
        className="overflow-x-auto rounded-md"
        tabIndex={0}
        role="region"
        aria-label={`${title} (scrollable)`}
      >
        <ChartPlot
          points={points}
          geometry={geometry}
          unit={unit}
          formatTime={formatTime}
          summaryId={summaryId}
        />
      </div>
      <p id={summaryId} className="text-ink-2 mt-2 text-sm">
        {summarizeSeries(points, label, formatTime)}
      </p>
      <ChartLegend />
      <button
        type="button"
        onClick={() => setShowTable((shown) => !shown)}
        aria-expanded={showTable}
        aria-controls={tableId}
        className="text-info-800 mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-semibold hover:underline"
      >
        <Table2 aria-hidden="true" className="size-4" />
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      <ChartDataTable
        id={tableId}
        hidden={!showTable}
        title={title}
        label={label}
        unit={unit}
        points={points}
        formatTime={formatTime}
      />
    </figure>
  );
}
