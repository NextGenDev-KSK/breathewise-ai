"use client";

import { useState } from "react";
import { Flame, RotateCcw, Target, Trophy } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { usePersistentState } from "@/hooks/usePersistentState";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  MISSION_ACTIONS,
  MISSION_DAYS,
  MissionStateSchema,
  missionDayIndex,
  missionProgress,
  newMission,
  todayIso,
  toggleAction,
  type MissionState,
} from "@/lib/engine/mission";

const NullableMission = MissionStateSchema.nullable();
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MissionTracker() {
  const { ready } = useApp();
  const toast = useToast();
  const [stored, setStored, loaded] = usePersistentState<MissionState | null>(STORAGE_KEYS.mission, NullableMission, null);
  const [confirmReset, setConfirmReset] = useState(false);
  const today = todayIso();
  const mission = stored;
  const dayIndex = mission ? missionDayIndex(mission, today) : null;
  const finished = mission !== null && dayIndex === null && today > mission.startedOn;

  if (!ready || !loaded) return <div role="status" className="h-64 animate-pulse rounded-2xl bg-line/60 motion-reduce:animate-none"><span className="sr-only">Loading your progress…</span></div>;

  const start = () => {
    setStored(newMission(today));
    toast("Your 7-day clean-air mission has started.", "success");
  };

  if (!mission) {
    return (
      <Card className="p-8 text-center">
        <Target aria-hidden="true" className="mx-auto size-10 text-brand-700" />
        <h2 className="mt-3 text-xl font-semibold">Start your 7-day clean-air mission</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">
          Seven small, practical habits that reduce your exposure and your household&apos;s emissions. Tick what you managed each day. Progress stays in this browser.
        </p>
        <Button className="mt-6" onClick={start}>
          Start mission
        </Button>
      </Card>
    );
  }

  const p = missionProgress(mission, today);
  const doneToday = dayIndex !== null ? new Set(mission.completions[String(dayIndex)] ?? []) : new Set<string>();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Mission day</p>
          <p className="tabular mt-1 text-3xl font-bold">{dayIndex !== null ? `${dayIndex + 1} of ${MISSION_DAYS}` : "Complete"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Actions completed</p>
          <p className="tabular mt-1 text-3xl font-bold">
            {p.totalCompleted} <span className="text-base font-medium text-ink-3">/ {p.totalPossible} ({p.percent}%)</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
            <Flame aria-hidden="true" className="size-3.5" /> Active-day streak
          </p>
          <p className="tabular mt-1 text-3xl font-bold">
            {p.streak} <span className="text-base font-medium text-ink-3">day{p.streak === 1 ? "" : "s"}</span>
          </p>
        </Card>
      </div>

      {dayIndex !== null ? (
        <Card>
          <CardHeader icon={<Target className="size-4" />} title={`Today's actions (day ${dayIndex + 1})`} description="Tick the actions you completed today." action={<span className="text-sm font-semibold text-ink-2" aria-live="polite">{doneToday.size} of {MISSION_ACTIONS.length} done</span>} />
          <ul className="divide-y divide-line px-2 py-2 sm:px-3">
            {MISSION_ACTIONS.map((a) => {
              const id = `mission-${a.id}`;
              const checked = doneToday.has(a.id);
              return (
                <li key={a.id} className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-canvas">
                  <input id={id} type="checkbox" checked={checked} onChange={() => setStored(toggleAction(mission, dayIndex, a.id))} className="mt-0.5 size-5 shrink-0 accent-brand-700" aria-describedby={`${id}-d`} />
                  <label htmlFor={id} className="flex-1 cursor-pointer">
                    <span className={cn("block text-sm font-medium", checked ? "text-ink-3 line-through" : "text-ink")}>{a.title}</span>
                    <span id={`${id}-d`} className="block text-xs text-ink-3">{a.detail}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : finished ? (
        <Card className="flex items-center gap-4 p-5">
          <Trophy aria-hidden="true" className="size-8 text-brand-700" />
          <div className="flex-1">
            <h2 className="font-semibold">Mission complete</h2>
            <p className="text-sm text-ink-2">You completed {p.totalCompleted} actions across {p.activeDays} active days. Start a new week to keep going.</p>
          </div>
          <Button onClick={start}>Start a new week</Button>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Weekly progress" description="Actions completed per mission day." />
        <div className="p-5">
          <ol className="grid grid-cols-7 items-end gap-2" aria-label="Actions completed each day">
            {p.perDay.map((d) => {
              const pct = (d.completed / MISSION_ACTIONS.length) * 100;
              const weekday = WEEKDAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()];
              const isToday = d.dayIndex === dayIndex;
              return (
                <li key={d.date} className="flex flex-col items-center gap-2">
                  <span className="tabular text-xs font-semibold text-ink-2">{d.completed}</span>
                  <div className="flex h-32 w-full max-w-12 items-end overflow-hidden rounded-lg bg-canvas" aria-hidden="true">
                    <div className={cn("w-full rounded-lg", d.completed ? "bg-brand-600" : "")} style={{ height: `${Math.max(pct, d.completed ? 6 : 0)}%` }} />
                  </div>
                  <span className={cn("text-xs", isToday ? "font-bold text-ink" : "text-ink-3")}>
                    {weekday}
                    <span className="sr-only">
                      , day {d.dayIndex + 1}: {d.completed} of {MISSION_ACTIONS.length} actions{isToday ? " (today)" : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your habits this week" description="How many days you completed each action." />
        <ul className="space-y-3 p-5">
          {MISSION_ACTIONS.map((a) => (
            <li key={a.id}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-ink">{a.title}</span>
                <span className="tabular text-ink-2">
                  {p.perAction[a.id]} / {MISSION_DAYS} days
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-canvas" aria-hidden="true">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${(p.perAction[a.id] / MISSION_DAYS) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-xs text-ink-3">These are personal habit records. BreatheWise does not claim that individual actions produce a measurable change in your city&apos;s AQI.</p>
          <Button variant="secondary" onClick={() => setConfirmReset(true)}>
            <RotateCcw aria-hidden="true" className="size-4" /> Reset weekly challenge
          </Button>
        </div>
      </Card>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset your mission?" description="This clears all ticked actions and starts a new 7-day mission today.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setStored(newMission(today));
              setConfirmReset(false);
              toast("Mission reset. Day 1 starts today.", "info");
            }}
          >
            Reset mission
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
