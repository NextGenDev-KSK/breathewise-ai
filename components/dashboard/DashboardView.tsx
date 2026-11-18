"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, ListChecks } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { AirDataGate } from "@/components/air/AirDataGate";
import { CurrentOverview } from "@/components/air/CurrentOverview";
import { PollutantGrid } from "@/components/air/PollutantGrid";
import { DataQualityPanel } from "@/components/air/DataQualityPanel";
import { IndiaAqiNotice } from "@/components/air/IndiaAqiNotice";
import { HourlyChart } from "@/components/air/HourlyChart";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import { Card, CardHeader } from "@/components/ui/Card";
import type { AirQualitySnapshot } from "@/types/air";
import { generateRecommendations } from "@/lib/engine/recommendations";
import { isIndianLocation, upcomingHours } from "@/lib/engine/analysis";
import { buildSeries } from "@/lib/air/series";

function Dashboard({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, nowMs, formatTime } = useApp();
  const recs = useMemo(
    () =>
      generateRecommendations({ snapshot, preferences, nowMs, formatTime }).filter(
        (r) => r.category !== "data" || r.id === "data-stale",
      ),
    [snapshot, preferences, nowMs, formatTime],
  );
  const next24 = useMemo(() => buildSeries(upcomingHours(snapshot, nowMs, 24), "pm2_5"), [snapshot, nowMs]);

  return (
    <div className="space-y-6">
      <CurrentOverview snapshot={snapshot} />
      {isIndianLocation(snapshot) && snapshot.origin !== "demo" ? <IndiaAqiNotice /> : null}

      <section aria-labelledby="actions-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="actions-heading" className="text-lg font-semibold">
              What to do today
            </h2>
            <p className="text-ink-3 text-sm">
              Prioritised by urgency and practicality. Open any card to see the data behind it.
            </p>
          </div>
          <Link
            href="/plan"
            className="text-brand-700 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold hover:underline"
          >
            <ListChecks aria-hidden="true" className="size-4" /> Full day plan{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        {recs.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recs.slice(0, 4).map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        ) : (
          <p className="border-line bg-surface text-ink-2 rounded-xl border p-4 text-sm">
            No specific actions are triggered by the current data.
          </p>
        )}
      </section>

      <Card>
        <CardHeader
          icon={<CalendarDays className="size-4" />}
          title="PM2.5 over the next 24 hours"
          description="Hourly model forecast. Bar colour and the table show the concern level."
          action={
            <Link
              href="/forecast"
              className="text-brand-700 inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
            >
              Forecast & best times <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
        />
        <div className="p-5">
          <HourlyChart
            points={next24}
            label="PM2.5"
            unit="µg/m³"
            formatTime={formatTime}
            title="PM2.5 forecast for the next 24 hours"
          />
        </div>
      </Card>

      <PollutantGrid snapshot={snapshot} />
      <DataQualityPanel snapshot={snapshot} />
    </div>
  );
}

export function DashboardView() {
  return <AirDataGate>{(snapshot) => <Dashboard snapshot={snapshot} />}</AirDataGate>;
}
