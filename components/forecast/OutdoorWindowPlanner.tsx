"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import type { Activity } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { ActivityPicker } from "@/components/forecast/ActivityPicker";
import { WindowResult } from "@/components/forecast/WindowResult";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { findOutdoorWindow, type OutdoorWindowResult } from "@/lib/engine/windows";

/** "Find My Better Outdoor Window": choose an activity, get the comparatively cleanest hour. */
export function OutdoorWindowPlanner({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, nowMs, formatTime } = useApp();
  const usual = preferences.outdoorActivity === "none" ? "walking" : preferences.outdoorActivity;
  const [activity, setActivity] = useState<Activity>(usual);
  const [result, setResult] = useState<OutdoorWindowResult | null>(null);

  const find = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(findOutdoorWindow(snapshot, { activity, household: preferences.household, nowMs, formatTime }));
  };

  return (
    <Card>
      <CardHeader
        icon={<Search className="size-4" />}
        title="Find my better outdoor window"
        description="Compares forecast hours in the next 24 hours and picks the comparatively cleanest one-hour slot."
      />
      <form onSubmit={find} className="p-5">
        <ActivityPicker value={activity} onChange={setActivity} />
        <Button type="submit" className="mt-4">
          Find my better outdoor window
        </Button>
      </form>
      <div aria-live="polite" className="px-5 pb-5 empty:hidden">
        {result ? <WindowResult result={result} formatTime={formatTime} /> : null}
      </div>
    </Card>
  );
}
