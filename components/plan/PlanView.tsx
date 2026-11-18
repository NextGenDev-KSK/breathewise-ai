"use client";

import { useMemo, useRef } from "react";
import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { AirDataGate } from "@/components/air/AirDataGate";
import { useToast } from "@/components/ui/Toast";
import { PreferencesCard } from "@/components/plan/PreferencesCard";
import { PlanPeriodCard } from "@/components/plan/PlanPeriodCard";
import { buildDailyPlan } from "@/lib/engine/plan";

function Plan({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, setPreferences, nowMs, formatTime } = useApp();
  const toast = useToast();
  const planRef = useRef<HTMLHeadingElement>(null);
  const plan = useMemo(
    () => buildDailyPlan(snapshot, preferences, nowMs, formatTime),
    [snapshot, preferences, nowMs, formatTime],
  );

  function save(p: Preferences) {
    setPreferences(p);
    toast("Your clean-air day plan has been updated.", "success");
    window.setTimeout(() => planRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-6">
      <PreferencesCard preferences={preferences} onSave={save} />

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
          {plan.periods.map((p) => (
            <li key={p.id}>
              <PlanPeriodCard period={p} cleanest={p.id === plan.cleanestPeriod} formatTime={formatTime} />
            </li>
          ))}
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

/** The clean-air day plan for the selected location, shown once air data is available. */
export function PlanView() {
  return <AirDataGate>{(s) => <Plan snapshot={s} />}</AirDataGate>;
}
