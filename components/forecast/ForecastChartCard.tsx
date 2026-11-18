"use client";

import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { HourlyChart } from "@/components/air/HourlyChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { buildSeries, SERIES_META, type SeriesMetric } from "@/lib/air/series";
import { upcomingHours } from "@/lib/engine/analysis";

const METRIC_OPTIONS = (["pm2_5", "pm10", "us_aqi", "european_aqi"] as const).map((value) => ({
  value,
  label: SERIES_META[value].label,
}));

/** The next 24 hours of one chosen measure (PM2.5, PM10, US AQI or European AQI). */
export function ForecastChartCard({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { nowMs, formatTime } = useApp();
  const [metric, setMetric] = useState<SeriesMetric>("pm2_5");
  const series = useMemo(
    () => buildSeries(upcomingHours(snapshot, nowMs, 24), metric),
    [snapshot, nowMs, metric],
  );
  const meta = SERIES_META[metric];
  const steps = snapshot.model.temporalResolution.startsWith("3")
    ? "values (model runs in 3-hour steps)"
    : "model forecast";

  return (
    <Card>
      <CardHeader
        icon={<LineChart className="size-4" />}
        title="Next 24 hours"
        description={`Hourly ${steps}.`}
      />
      <div className="p-5">
        <div className="mb-4">
          <SegmentedControl
            legend="Forecast measure"
            hideLegend
            value={metric}
            options={METRIC_OPTIONS}
            onChange={setMetric}
          />
        </div>
        {series.some((point) => point.value !== null) ? (
          <HourlyChart
            points={series}
            label={meta.label}
            unit={meta.unit}
            formatTime={formatTime}
            title={`${meta.label} forecast for the next 24 hours`}
          />
        ) : (
          <p className="bg-canvas text-ink-2 rounded-lg p-4 text-sm">
            {meta.label} is not available in the forecast for this location.
          </p>
        )}
      </div>
    </Card>
  );
}
