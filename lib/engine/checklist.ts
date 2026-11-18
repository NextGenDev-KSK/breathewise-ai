import { z } from "zod";

/** Ticked indoor-checklist items for one local calendar date. Progress resets each day. */
export const ChecklistProgressSchema = z.object({
  date: z.string().max(10),
  done: z.array(z.string().max(40)).max(50),
});
export type ChecklistProgress = z.infer<typeof ChecklistProgressSchema>;

export const EMPTY_CHECKLIST_PROGRESS: ChecklistProgress = { date: "", done: [] };

/** Item ids ticked today; progress saved on an earlier date counts as nothing ticked. */
export function completedToday(progress: ChecklistProgress, today: string): ReadonlySet<string> {
  return new Set(progress.date === today ? progress.done : []);
}

/** Ticks or unticks one item for today. */
export function toggleChecklistItem(
  progress: ChecklistProgress,
  itemId: string,
  today: string,
): ChecklistProgress {
  const done = new Set(completedToday(progress, today));
  if (done.has(itemId)) done.delete(itemId);
  else done.add(itemId);
  return { date: today, done: [...done] };
}
