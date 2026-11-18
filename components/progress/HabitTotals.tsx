import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { MISSION_ACTIONS, MISSION_DAYS, type MissionProgress } from "@/lib/engine/mission";

/** How many days each habit was completed, plus the reset control. */
export function HabitTotals({ progress, onReset }: { progress: MissionProgress; onReset: () => void }) {
  return (
    <Card>
      <CardHeader title="Your habits this week" description="How many days you completed each action." />
      <ul className="space-y-3 p-5">
        {MISSION_ACTIONS.map((action) => (
          <li key={action.id}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-ink">{action.title}</span>
              <span className="tabular text-ink-2">
                {progress.perAction[action.id]} / {MISSION_DAYS} days
              </span>
            </div>
            <div className="bg-canvas mt-1 h-2 rounded-full" aria-hidden="true">
              <div
                className="bg-brand-600 h-full rounded-full"
                style={{ width: `${(progress.perAction[action.id] / MISSION_DAYS) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="border-line border-t px-5 py-4">
        <p className="text-ink-3 mb-3 text-xs">
          These are personal habit records. BreatheWise does not claim that individual actions produce a
          measurable change in your city&apos;s AQI.
        </p>
        <Button variant="secondary" onClick={onReset}>
          <RotateCcw aria-hidden="true" className="size-4" /> Reset weekly challenge
        </Button>
      </div>
    </Card>
  );
}
