"use client";

import { CheckCircle2, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/components/ui/cn";
import { useStoredState } from "@/hooks/useStoredState";
import {
  ChecklistProgressSchema,
  completedToday,
  EMPTY_CHECKLIST_PROGRESS,
  toggleChecklistItem,
} from "@/lib/engine/checklist";
import type { ChecklistItem } from "@/lib/engine/indoor";
import { todayIso } from "@/lib/engine/mission";
import { STORAGE_KEYS } from "@/lib/storage";

/** Today's personalised checklist; ticks are saved in this browser and reset each day. */
export function IndoorChecklist({ items }: { items: ChecklistItem[] }) {
  const [progress, setProgress] = useStoredState(
    STORAGE_KEYS.indoorChecklist,
    ChecklistProgressSchema,
    EMPTY_CHECKLIST_PROGRESS,
  );
  const today = todayIso();
  const done = completedToday(progress, today);
  const completed = items.filter((item) => done.has(item.id)).length;
  const allDone = items.length > 0 && completed === items.length;

  return (
    <Card>
      <CardHeader
        icon={<ListChecks className="size-4" />}
        title="Today's indoor checklist"
        description="Personalised from your equipment, household and today's outdoor level. Progress is saved in this browser and resets daily."
        action={
          <span className="text-ink-2 text-sm font-semibold" aria-live="polite">
            {completed} of {items.length} done
          </span>
        }
      />
      <div className="px-5 pt-4">
        <ProgressBar label="Checklist progress" value={completed} max={items.length} />
      </div>
      <ul className="divide-line divide-y px-2 py-2 sm:px-3">
        {items.map((item) => {
          const checked = done.has(item.id);
          const inputId = `check-${item.id}`;
          return (
            <li key={item.id} className="hover:bg-canvas flex items-start gap-3 rounded-lg px-3 py-3">
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => setProgress((current) => toggleChecklistItem(current, item.id, today))}
                className="accent-brand-700 mt-0.5 size-5 shrink-0"
                aria-describedby={`${inputId}-d`}
              />
              <label htmlFor={inputId} className="flex-1 cursor-pointer">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    checked ? "text-ink-3 line-through" : "text-ink",
                  )}
                >
                  {item.title}
                </span>
                <span id={`${inputId}-d`} className="text-ink-3 block text-xs">
                  {item.detail}
                </span>
              </label>
              <Badge tone="neutral" className="hidden capitalize sm:inline-flex">
                {item.category}
              </Badge>
            </li>
          );
        })}
      </ul>
      {allDone ? (
        <p className="border-line text-brand-800 flex items-center gap-2 border-t px-5 py-3 text-sm font-semibold">
          <CheckCircle2 aria-hidden="true" className="size-4" /> All done for today. Nice work.
        </p>
      ) : null}
      {completed > 0 ? (
        <div className="border-line border-t px-5 py-3">
          <Button size="sm" variant="ghost" onClick={() => setProgress({ date: today, done: [] })}>
            Clear today&apos;s checks
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
