"use client";

import { useMemo, useRef, useState } from "react";
import { Moon, Settings2, Sun, Sunrise, Sunset } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { AirDataGate } from "@/components/air/AirDataGate";
import { Card, CardHeader } from "@/components/ui/Card";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { useToast } from "@/components/ui/Toast";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import { PreferencesForm } from "@/components/plan/PreferencesForm";
import { buildDailyPlan, type PeriodId } from "@/lib/engine/plan";
import { describeMetricValue } from "@/lib/engine/analysis";

const PERIOD_ICONS: Record<PeriodId, typeof Sun> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

function Plan({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, setPreferences, nowMs, formatTime } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const planRef = useRef<HTMLHeadingElement>(null);
  const plan = useMemo(
    () => buildDailyPlan(snapshot, preferences, nowMs, formatTime),
    [snapshot, preferences, nowMs, formatTime],
  );

  function save(p: Preferences) {
    setPreferences(p);
    setEditing(false);
    toast("Your clean-air day plan has been updated.", "success");
    window.setTimeout(() => planRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={<Settings2 className="size-4" />}
          title="Your routine and household"
          description="Optional. Saved only in this browser and used to tailor the plan."
          action={
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-expanded={editing}
              aria-controls="prefs-form"
              className="text-brand-700 hover:bg-brand-50 min-h-11 rounded-lg px-3 text-sm font-semibold"
            >
              {editing ? "Close" : "Edit preferences"}
            </button>
          }
        />
        <div id="prefs-form" className="p-5" hidden={!editing}>
          {editing ? <PreferencesForm initial={preferences} onSubmit={save} /> : null}
        </div>
      </Card>

      <section aria-labelledby="plan-heading">
        <h2
          id="plan-heading"
          ref={planRef}
          tabIndex={-1}
          className="text-lg font-semibold focus:outline-none"
        >
          My clean-air day
        </h2>
        <p className="text-ink-2 mt-1 text-sm" role="status">
          {plan.headline}
        </p>
        <p className="text-ink-3 mt-1 text-xs">
          Based on data for {formatTime(plan.dataTime)} local time. The plan adapts automatically when new
          data loads.
        </p>

        <ol className="mt-5 space-y-6">
          {plan.periods.map((p) => {
            const Icon = PERIOD_ICONS[p.id];
            return (
              <li key={p.id}>
                <Card className={p.id === plan.cleanestPeriod ? "ring-brand-500/40 ring-2" : undefined}>
                  <div className="border-line flex flex-wrap items-center gap-3 border-b px-5 py-4">
                    <span
                      aria-hidden="true"
                      className="bg-navy-900 grid size-9 place-items-center rounded-lg text-white"
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold">
                        {p.label}{" "}
                        <span className="text-ink-3 font-normal">
                          · {p.dayLabel}
                          {p.startTime ? `, ${formatTime(p.startTime)}–${formatTime(p.endTime)}` : ""}
                        </span>
                      </h3>
                      {p.stats ? (
                        <p className="text-ink-3 text-xs">
                          Average {describeMetricValue(p.stats.metric, p.stats.mean)}, peak{" "}
                          {describeMetricValue(p.stats.metric, p.stats.max)}
                        </p>
                      ) : (
                        <p className="text-ink-3 text-xs">No forecast data for this period.</p>
                      )}
                    </div>
                    {p.stats ? <LevelBadge level={p.stats.level} /> : null}
                    {p.id === plan.cleanestPeriod ? (
                      <span className="bg-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
                        Cleanest period
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {p.items.map((r) => (
                      <RecommendationCard key={r.id} rec={r} headingLevel="h4" />
                    ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
        <ul className="text-ink-3 mt-4 list-disc space-y-1 pl-5 text-xs">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function PlanView() {
  return <AirDataGate>{(s) => <Plan snapshot={s} />}</AirDataGate>;
}
