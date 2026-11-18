import type { Activity } from "@/types/preferences";
import type { ConcernLevel } from "@/lib/air/indices";

/** How hard an activity makes you breathe; heavier breathing draws in more polluted air. */
export type Intensity = "light" | "moderate" | "vigorous";

export interface ActivityProfile {
  label: string;
  intensity: Intensity;
  durationHours: number;
  /** Local hours (inclusive start, exclusive end) when the activity is realistic. */
  earliestHour: number;
  latestHour: number;
  involvesChildren: boolean;
}

export const ACTIVITY_PROFILES: Record<Activity, ActivityProfile> = {
  walking: {
    label: "Walking",
    intensity: "light",
    durationHours: 1,
    earliestHour: 5,
    latestHour: 22,
    involvesChildren: false,
  },
  jogging: {
    label: "Jogging",
    intensity: "vigorous",
    durationHours: 1,
    earliestHour: 5,
    latestHour: 21,
    involvesChildren: false,
  },
  cycling: {
    label: "Cycling",
    intensity: "vigorous",
    durationHours: 1,
    earliestHour: 5,
    latestHour: 21,
    involvesChildren: false,
  },
  children_play: {
    label: "Children's outdoor play",
    intensity: "moderate",
    durationHours: 1,
    earliestHour: 7,
    latestHour: 19,
    involvesChildren: true,
  },
  commuting: {
    label: "Commuting",
    intensity: "light",
    durationHours: 1,
    earliestHour: 6,
    latestHour: 22,
    involvesChildren: false,
  },
  exercise: {
    label: "Outdoor exercise",
    intensity: "vigorous",
    durationHours: 1,
    earliestHour: 5,
    latestHour: 21,
    involvesChildren: false,
  },
};

/** How strongly to caution about doing an activity in a given window. */
export type Verdict = "reasonable" | "reduce" | "avoid" | "unknown";

/** Decides how strongly to caution, based on level, exertion and who is involved. */
export function decideVerdict(level: ConcernLevel, intensity: Intensity, sensitive: boolean): Verdict {
  if (level >= 4) return "avoid";
  if (level === 3) return intensity === "vigorous" || sensitive ? "avoid" : "reduce";
  if (level === 2) return intensity === "vigorous" || sensitive ? "reduce" : "reasonable";
  if (level === 1) return sensitive && intensity === "vigorous" ? "reduce" : "reasonable";
  return "reasonable";
}
