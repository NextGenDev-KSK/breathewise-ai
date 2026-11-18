import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { MISSION_ACTIONS, type MissionProgress } from "@/lib/engine/mission";
import { weekdayShort } from "@/lib/time";

/** Bars give a minimum visible height once a day has at least one action. */
const MIN_BAR_PERCENT = 6;

/** Actions completed per mission day; each bar also has a screen-reader description. */
export function WeeklyChart({ progress, dayIndex }: { progress: MissionProgress; dayIndex: number | null }) {
  return (
    <Card>
      <CardHeader title="Weekly progress" description="Actions completed per mission day." />
      <div className="p-5">
        <ol className="grid grid-cols-7 items-end gap-2" aria-label="Actions completed each day">
          {progress.perDay.map((day) => {
            const percent = (day.completed / MISSION_ACTIONS.length) * 100;
            const isToday = day.dayIndex === dayIndex;
            return (
              <li key={day.date} className="flex flex-col items-center gap-2">
                <span className="tabular text-ink-2 text-xs font-semibold">{day.completed}</span>
                <div
                  className="bg-canvas flex h-32 w-full max-w-12 items-end overflow-hidden rounded-lg"
                  aria-hidden="true"
                >
                  <div
                    className={cn("w-full rounded-lg", day.completed ? "bg-brand-600" : "")}
                    style={{ height: `${day.completed ? Math.max(percent, MIN_BAR_PERCENT) : 0}%` }}
                  />
                </div>
                <span className={cn("text-xs", isToday ? "text-ink font-bold" : "text-ink-3")}>
                  {weekdayShort(day.date)}
                  <span className="sr-only">
                    , day {day.dayIndex + 1}: {day.completed} of {MISSION_ACTIONS.length} actions
                    {isToday ? " (today)" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
