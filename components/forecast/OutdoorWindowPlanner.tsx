"use client";

import { useState } from "react";
import {
  Bike,
  Footprints,
  PersonStanding,
  Activity as ActivityIcon,
  Baby,
  TramFront,
  Search,
  TriangleAlert,
  Info,
} from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { ACTIVITIES, type Activity } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { cn } from "@/components/ui/cn";
import { ACTIVITY_PROFILES } from "@/lib/engine/activities";
import { findOutdoorWindow, windowRange, type OutdoorWindowResult } from "@/lib/engine/windows";

const ICONS: Record<Activity, typeof Bike> = {
  walking: Footprints,
  jogging: PersonStanding,
  cycling: Bike,
  children_play: Baby,
  commuting: TramFront,
  exercise: ActivityIcon,
};

const VERDICT_STYLE = {
  reasonable: "border-brand-100 bg-brand-50",
  reduce: "border-caution-200 bg-caution-50",
  avoid: "border-red-200 bg-danger-50",
  unknown: "border-line bg-canvas",
} as const;

export function OutdoorWindowPlanner({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, nowMs, formatTime } = useApp();
  const initial: Activity = preferences.outdoorActivity === "none" ? "walking" : preferences.outdoorActivity;
  const [activity, setActivity] = useState<Activity>(initial);
  const [result, setResult] = useState<OutdoorWindowResult | null>(null);

  function find(e: React.FormEvent) {
    e.preventDefault();
    setResult(findOutdoorWindow(snapshot, { activity, household: preferences.household, nowMs, formatTime }));
  }

  return (
    <Card>
      <CardHeader
        icon={<Search className="size-4" />}
        title="Find my better outdoor window"
        description="Compares forecast hours in the next 24 hours and picks the comparatively cleanest one-hour slot."
      />
      <form onSubmit={find} className="p-5">
        <fieldset>
          <legend className="text-ink text-sm font-semibold">What do you plan to do?</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIVITIES.map((a) => {
              const Icon = ICONS[a];
              const checked = activity === a;
              return (
                <label
                  key={a}
                  className={cn(
                    "has-[:focus-visible]:outline-info-700 flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-3",
                    checked
                      ? "border-brand-700 bg-brand-50 text-ink"
                      : "border-line-strong text-ink-2 hover:bg-canvas",
                  )}
                >
                  <input
                    type="radio"
                    name="activity"
                    value={a}
                    checked={checked}
                    onChange={() => setActivity(a)}
                    className="sr-only"
                  />
                  <Icon
                    aria-hidden="true"
                    className={cn("size-4", checked ? "text-brand-700" : "text-ink-3")}
                  />
                  {ACTIVITY_PROFILES[a].label}
                  <span className="text-ink-3 ml-auto text-xs">{ACTIVITY_PROFILES[a].intensity}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Button type="submit" className="mt-4">
          Find my better outdoor window
        </Button>
      </form>

      <div aria-live="polite" className="px-5 pb-5 empty:hidden">
        {result ? (
          <section
            aria-label="Outdoor window result"
            className={cn("rounded-xl border p-4", VERDICT_STYLE[result.verdict])}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-ink text-base font-semibold">{result.headline}</h3>
              {result.best ? <LevelBadge level={result.best.level} /> : null}
            </div>
            {result.best && result.verdict !== "avoid" ? (
              <p className="text-ink-2 mt-1 text-sm">
                Comparatively better than other forecast hours. This does not mean the air is clean or
                risk-free.
              </p>
            ) : null}
            {result.verdict === "avoid" && result.best ? (
              <p className="text-ink-2 mt-1 text-sm">
                If you do go, {windowRange(result.best, formatTime)} is comparatively lower.
              </p>
            ) : null}
            <ul className="text-ink-2 mt-3 list-disc space-y-1 pl-5 text-sm">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {result.cautions.length ? (
              <div className="text-caution-800 mt-3 flex gap-2 text-sm">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>{result.cautions.join(" ")}</p>
              </div>
            ) : null}
            <div className="text-ink-3 mt-3 flex gap-2 text-xs">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <p>
                {result.uncertain ? <strong className="text-ink-2">Uncertain recommendation. </strong> : null}
                {result.uncertaintyNotes.join(" ")} Based on {result.metricLabel ?? "available data"}; no
                route-specific data is used.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </Card>
  );
}
