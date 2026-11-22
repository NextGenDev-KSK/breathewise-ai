import { z } from "zod";

export const COMMUTE_MODES = ["car", "carpool", "two_wheeler", "bus", "metro", "walk", "cycle"] as const;
export type CommuteMode = (typeof COMMUTE_MODES)[number];

export const ACTIVITIES = [
  "walking",
  "jogging",
  "cycling",
  "children_play",
  "commuting",
  "exercise",
] as const;
export type Activity = (typeof ACTIVITIES)[number];

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour) format");

export const HouseholdSchema = z.object({
  children: z.boolean(),
  olderAdults: z.boolean(),
  respiratorySensitivity: z.boolean(),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const PreferencesSchema = z.object({
  routine: z.enum(["office", "student", "home", "shift"]),
  commuteMode: z.enum([...COMMUTE_MODES, "none"]),
  leaveTime: timeOfDay,
  returnTime: timeOfDay,
  outdoorActivity: z.enum([...ACTIVITIES, "none"]),
  preferredActivityTime: z.enum(["morning", "evening", "flexible"]),
  household: HouseholdSchema,
  equipment: z.object({
    airPurifier: z.boolean(),
    kitchenExhaust: z.boolean(),
  }),
  cookingFuel: z.enum(["gas", "electric", "biomass", "unknown"]),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  routine: "office",
  commuteMode: "two_wheeler",
  leaveTime: "09:00",
  returnTime: "18:30",
  outdoorActivity: "walking",
  preferredActivityTime: "flexible",
  household: { children: false, olderAdults: false, respiratorySensitivity: false },
  equipment: { airPurifier: false, kitchenExhaust: false },
  cookingFuel: "gas",
};

export const SettingsSchema = z.object({
  aqiStandard: z.enum(["us", "eu"]),
  timeFormat: z.enum(["24h", "12h"]),
  aiEnabled: z.boolean(),
  demoMode: z.boolean(),
  onboarded: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  aqiStandard: "us",
  timeFormat: "24h",
  aiEnabled: true,
  demoMode: false,
  onboarded: false,
};

/** True when the household includes children, older adults or someone sensitive to air pollution. */
export function hasSensitiveMember(household: Household): boolean {
  return household.children || household.olderAdults || household.respiratorySensitivity;
}
