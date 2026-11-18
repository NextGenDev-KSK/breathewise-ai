import { Target } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { MISSION_ACTIONS, type MissionActionId } from "@/lib/engine/mission";

interface TodayActionsProps {
  dayIndex: number;
  done: ReadonlySet<MissionActionId>;
  onToggle: (actionId: MissionActionId) => void;
}

export function TodayActions({ dayIndex, done, onToggle }: TodayActionsProps) {
  return (
    <Card>
      <CardHeader
        icon={<Target className="size-4" />}
        title={`Today's actions (day ${dayIndex + 1})`}
        description="Tick the actions you completed today."
        action={
          <span className="text-ink-2 text-sm font-semibold" aria-live="polite">
            {done.size} of {MISSION_ACTIONS.length} done
          </span>
        }
      />
      <ul className="divide-line divide-y px-2 py-2 sm:px-3">
        {MISSION_ACTIONS.map((action) => {
          const id = `mission-${action.id}`;
          const checked = done.has(action.id);
          return (
            <li key={action.id} className="hover:bg-canvas flex items-start gap-3 rounded-lg px-3 py-3">
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(action.id)}
                className="accent-brand-700 mt-0.5 size-5 shrink-0"
                aria-describedby={`${id}-d`}
              />
              <label htmlFor={id} className="flex-1 cursor-pointer">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    checked ? "text-ink-3 line-through" : "text-ink",
                  )}
                >
                  {action.title}
                </span>
                <span id={`${id}-d`} className="text-ink-3 block text-xs">
                  {action.detail}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
