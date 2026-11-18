"use client";

import { useState } from "react";
import { Target, Trophy } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { HabitTotals } from "@/components/progress/HabitTotals";
import { MissionStats } from "@/components/progress/MissionStats";
import { TodayActions } from "@/components/progress/TodayActions";
import { WeeklyChart } from "@/components/progress/WeeklyChart";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useStoredState } from "@/hooks/useStoredState";
import {
  actionsDoneOn,
  MissionStateSchema,
  missionDayIndex,
  missionProgress,
  newMission,
  todayIso,
  toggleAction,
  type MissionState,
} from "@/lib/engine/mission";
import { STORAGE_KEYS } from "@/lib/storage";

const NullableMissionSchema = MissionStateSchema.nullable();

function StartMission({ onStart }: { onStart: () => void }) {
  return (
    <Card className="p-8 text-center">
      <Target aria-hidden="true" className="text-brand-700 mx-auto size-10" />
      <h2 className="mt-3 text-xl font-semibold">Start your 7-day clean-air mission</h2>
      <p className="text-ink-2 mx-auto mt-2 max-w-lg text-sm">
        Seven small, practical habits that reduce your exposure and your household&apos;s emissions. Tick what
        you managed each day. Progress stays in this browser.
      </p>
      <Button className="mt-6" onClick={onStart}>
        Start mission
      </Button>
    </Card>
  );
}

function MissionComplete({
  completed,
  activeDays,
  onRestart,
}: {
  completed: number;
  activeDays: number;
  onRestart: () => void;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <Trophy aria-hidden="true" className="text-brand-700 size-8" />
      <div className="flex-1">
        <h2 className="font-semibold">Mission complete</h2>
        <p className="text-ink-2 text-sm">
          You completed {completed} actions across {activeDays} active days. Start a new week to keep going.
        </p>
      </div>
      <Button onClick={onRestart}>Start a new week</Button>
    </Card>
  );
}

export function MissionTracker() {
  const { ready } = useApp();
  const toast = useToast();
  const [mission, setMission] = useStoredState<MissionState | null>(
    STORAGE_KEYS.mission,
    NullableMissionSchema,
    null,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const today = todayIso();

  if (!ready) {
    return (
      <div role="status" className="bg-line/60 h-64 animate-pulse rounded-2xl motion-reduce:animate-none">
        <span className="sr-only">Loading your progress…</span>
      </div>
    );
  }

  const start = () => {
    setMission(newMission(today));
    toast("Your 7-day clean-air mission has started.", "success");
  };

  if (!mission) return <StartMission onStart={start} />;

  const dayIndex = missionDayIndex(mission, today);
  const finished = dayIndex === null && today > mission.startedOn;
  const progress = missionProgress(mission, today);

  return (
    <div className="space-y-6">
      <MissionStats progress={progress} dayIndex={dayIndex} />
      {dayIndex !== null ? (
        <TodayActions
          dayIndex={dayIndex}
          done={actionsDoneOn(mission, dayIndex)}
          onToggle={(actionId) => setMission(toggleAction(mission, dayIndex, actionId))}
        />
      ) : null}
      {finished ? (
        <MissionComplete
          completed={progress.totalCompleted}
          activeDays={progress.activeDays}
          onRestart={start}
        />
      ) : null}
      <WeeklyChart progress={progress} dayIndex={dayIndex} />
      <HabitTotals progress={progress} onReset={() => setConfirmReset(true)} />
      <ConfirmDialog
        open={confirmReset}
        title="Reset your mission?"
        description="This clears all ticked actions and starts a new 7-day mission today."
        confirmLabel="Reset mission"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setMission(newMission(today));
          setConfirmReset(false);
          toast("Mission reset. Day 1 starts today.", "info");
        }}
      />
    </div>
  );
}
