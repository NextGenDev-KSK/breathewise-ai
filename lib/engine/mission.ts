import { z } from "zod";
import { recordFromKeys } from "@/lib/collections";

export const MISSION_DAYS = 7;

export const MISSION_ACTIONS = [
  {
    id: "better-window",
    title: "Chose a better outdoor activity window",
    detail: "Used the forecast to time a walk, run or play session.",
  },
  {
    id: "skip-trip",
    title: "Avoided an unnecessary vehicle trip",
    detail: "Combined errands, worked remotely, or skipped a short drive.",
  },
  {
    id: "low-emission",
    title: "Used lower-emission transport",
    detail: "Took metro, bus, walked or cycled where practical and safe.",
  },
  {
    id: "no-smoke",
    title: "Reduced indoor smoke sources",
    detail: "No incense, coils, candles or indoor smoking today.",
  },
  {
    id: "ventilation",
    title: "Ventilated at a sensible time",
    detail: "Aired out when outdoor air was comparatively better; extracted while cooking.",
  },
  {
    id: "dust",
    title: "Reduced dust at home",
    detail: "Damp dusting, wet mopping or shoes off at the door.",
  },
  {
    id: "follow-plan",
    title: "Followed my clean-air day plan",
    detail: "Checked My Clean-Air Day and acted on at least one item.",
  },
] as const;
export type MissionActionId = (typeof MISSION_ACTIONS)[number]["id"];
const ACTION_IDS = MISSION_ACTIONS.map((a) => a.id) as [MissionActionId, ...MissionActionId[]];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MissionStateSchema = z.object({
  startedOn: isoDate,
  /** Day index (0–6) → completed action ids. */
  completions: z.record(z.string().regex(/^[0-6]$/), z.array(z.enum(ACTION_IDS))),
});
export type MissionState = z.infer<typeof MissionStateSchema>;

/** Local calendar date (YYYY-MM-DD) in the browser's time zone. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A fresh 7-day mission starting on the given local date. */
export function newMission(today: string): MissionState {
  return { startedOn: today, completions: {} };
}

/** Whole days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Current mission day (0–6), or null if the mission has finished or not started. */
export function missionDayIndex(state: MissionState, today: string): number | null {
  const d = daysBetween(state.startedOn, today);
  return d >= 0 && d < MISSION_DAYS ? d : null;
}

/**
 * Marks an action done or not done on a mission day. Returns the state unchanged for days outside
 * the mission, and keeps completions in the catalogue's order.
 */
export function toggleAction(state: MissionState, dayIndex: number, actionId: MissionActionId): MissionState {
  if (dayIndex < 0 || dayIndex >= MISSION_DAYS) return state;
  const key = String(dayIndex);
  const done = new Set(state.completions[key] ?? []);
  if (done.has(actionId)) done.delete(actionId);
  else done.add(actionId);
  return { ...state, completions: { ...state.completions, [key]: ACTION_IDS.filter((id) => done.has(id)) } };
}

/** Action ids completed on one mission day. */
export function actionsDoneOn(state: MissionState, dayIndex: number): ReadonlySet<MissionActionId> {
  return new Set(state.completions[String(dayIndex)] ?? []);
}

export interface MissionProgress {
  perDay: { dayIndex: number; date: string; completed: number }[];
  totalCompleted: number;
  totalPossible: number;
  percent: number;
  activeDays: number;
  /** Consecutive days with ≥1 action, ending at the given day. */
  streak: number;
  perAction: Record<MissionActionId, number>;
}

/** Per-day and per-action totals, completion percentage, active days and current streak. */
export function missionProgress(state: MissionState, today: string): MissionProgress {
  const start = Date.parse(`${state.startedOn}T00:00:00Z`);
  const perDay = Array.from({ length: MISSION_DAYS }, (_, i) => ({
    dayIndex: i,
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    completed: state.completions[String(i)]?.length ?? 0,
  }));
  const totalCompleted = perDay.reduce((s, d) => s + d.completed, 0);
  const totalPossible = MISSION_DAYS * MISSION_ACTIONS.length;
  const perAction = recordFromKeys(ACTION_IDS, () => 0);
  for (const ids of Object.values(state.completions)) for (const id of ids) perAction[id] += 1;

  const lastDay = Math.min(Math.max(daysBetween(state.startedOn, today), 0), MISSION_DAYS - 1);
  let streak = 0;
  for (let i = lastDay; i >= 0; i--) {
    const c = perDay[i]?.completed ?? 0;
    if (c > 0) streak++;
    else if (i === lastDay)
      continue; // today not yet started doesn't break the streak
    else break;
  }
  return {
    perDay,
    totalCompleted,
    totalPossible,
    percent: Math.round((totalCompleted / totalPossible) * 100),
    activeDays: perDay.filter((d) => d.completed > 0).length,
    streak,
    perAction,
  };
}
