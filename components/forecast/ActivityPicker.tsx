import {
  Activity as ActivityIcon,
  Baby,
  Bike,
  Footprints,
  PersonStanding,
  TramFront,
  type LucideIcon,
} from "lucide-react";
import { ACTIVITIES, type Activity } from "@/types/preferences";
import { cn } from "@/components/ui/cn";
import { ACTIVITY_PROFILES } from "@/lib/engine/activities";

const ICONS: Record<Activity, LucideIcon> = {
  walking: Footprints,
  jogging: PersonStanding,
  cycling: Bike,
  children_play: Baby,
  commuting: TramFront,
  exercise: ActivityIcon,
};

/** Activity choice as large radio cards, each showing how strenuous the activity is. */
export function ActivityPicker({
  value,
  onChange,
}: {
  value: Activity;
  onChange: (activity: Activity) => void;
}) {
  return (
    <fieldset>
      <legend className="text-ink text-sm font-semibold">What do you plan to do?</legend>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIVITIES.map((activity) => {
          const Icon = ICONS[activity];
          const checked = activity === value;
          return (
            <label
              key={activity}
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
                value={activity}
                checked={checked}
                onChange={() => onChange(activity)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className={cn("size-4", checked ? "text-brand-700" : "text-ink-3")} />
              {ACTIVITY_PROFILES[activity].label}
              <span className="text-ink-3 ml-auto text-xs">{ACTIVITY_PROFILES[activity].intensity}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
