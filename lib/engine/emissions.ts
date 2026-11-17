import { z } from "zod";
import { COMMUTE_MODES, type CommuteMode } from "@/types/preferences";

export interface EmissionFactor {
  mode: CommuteMode;
  label: string;
  /** Life-cycle grams CO₂e per passenger-km in the reference case study. */
  gramsPerPassengerKm: number;
  note: string;
}

export const EMISSION_SOURCE = {
  title: "OECD (2023), Life-cycle assessment of passenger transport: an Indian case study",
  url: "https://www.oecd.org/content/dam/oecd/en/publications/reports/2023/08/life-cycle-assessment-of-passenger-transport_9e2ebe5e/2d11e416-en.pdf",
};

/**
 * Illustrative, approximate life-cycle factors for an Indian case study. They are
 * not exact for any specific vehicle, city, occupancy level or journey.
 */
export const EMISSION_FACTORS: Record<CommuteMode, EmissionFactor> = {
  car: { mode: "car", label: "Private car (petrol/diesel)", gramsPerPassengerKm: 162, note: "Approximate; varies strongly with occupancy and vehicle." },
  two_wheeler: { mode: "two_wheeler", label: "Two-wheeler (motorcycle/scooter)", gramsPerPassengerKm: 65, note: "Approximate motorcycle factor." },
  bus: { mode: "bus", label: "Public bus", gramsPerPassengerKm: 28, note: "Urban non-AC bus example; depends on occupancy." },
  metro: { mode: "metro", label: "Metro", gramsPerPassengerKm: 24, note: "Depends on ridership and grid electricity mix." },
  walk: { mode: "walk", label: "Walking", gramsPerPassengerKm: 0, note: "Zero direct operational emissions in this simplified comparison." },
  cycle: { mode: "cycle", label: "Cycling", gramsPerPassengerKm: 0, note: "Zero direct operational emissions in this simplified comparison." },
};

/** Average weeks per month (52 / 12). */
export const WEEKS_PER_MONTH = 52 / 12;

export const CommuteInputSchema = z.object({
  distanceKm: z.number({ error: "Enter a distance in kilometres." }).min(0.1, "Distance must be at least 0.1 km.").max(200, "Distance must be 200 km or less."),
  tripsPerDay: z.number({ error: "Enter the number of trips per day." }).int("Trips per day must be a whole number.").min(1, "At least 1 trip per day.").max(10, "At most 10 trips per day."),
  daysPerWeek: z.number({ error: "Enter commuting days per week." }).int("Days must be a whole number.").min(1, "At least 1 day per week.").max(7, "At most 7 days per week."),
  currentMode: z.enum(COMMUTE_MODES),
  alternativeMode: z.enum(COMMUTE_MODES),
});
export type CommuteInput = z.infer<typeof CommuteInputSchema>;

export interface CommuteResult {
  weeklyKm: number;
  current: { mode: CommuteMode; perTripKg: number; weeklyKg: number; monthlyKg: number };
  alternative: { mode: CommuteMode; perTripKg: number; weeklyKg: number; monthlyKg: number };
  /** Positive when the alternative emits less. */
  weeklySavingKg: number;
  monthlySavingKg: number;
  yearlySavingKg: number;
  /** Relative change of the alternative versus current; null when current is zero. */
  relativeChange: number | null;
}

const toKg = (grams: number) => grams / 1000;
const round2 = (v: number) => Math.round(v * 100) / 100;

function modeEmissions(mode: CommuteMode, distanceKm: number, weeklyKm: number) {
  const g = EMISSION_FACTORS[mode].gramsPerPassengerKm;
  const weeklyKg = toKg(g * weeklyKm);
  return { mode, perTripKg: round2(toKg(g * distanceKm)), weeklyKg: round2(weeklyKg), monthlyKg: round2(weeklyKg * WEEKS_PER_MONTH) };
}

/** Estimates CO₂e for the current and alternative modes. Input must already be validated. */
export function calculateCommuteEmissions(input: CommuteInput): CommuteResult {
  const weeklyKm = input.distanceKm * input.tripsPerDay * input.daysPerWeek;
  const cur = modeEmissions(input.currentMode, input.distanceKm, weeklyKm);
  const alt = modeEmissions(input.alternativeMode, input.distanceKm, weeklyKm);
  const curG = EMISSION_FACTORS[input.currentMode].gramsPerPassengerKm * weeklyKm;
  const altG = EMISSION_FACTORS[input.alternativeMode].gramsPerPassengerKm * weeklyKm;
  const weeklySavingKg = toKg(curG - altG);
  return {
    weeklyKm: round2(weeklyKm),
    current: cur,
    alternative: alt,
    weeklySavingKg: round2(weeklySavingKg),
    monthlySavingKg: round2(weeklySavingKg * WEEKS_PER_MONTH),
    yearlySavingKg: round2(weeklySavingKg * 52),
    relativeChange: curG > 0 ? (altG - curG) / curG : null,
  };
}

/** Grams CO₂e avoided per passenger-km by switching modes (negative = more emissions). */
export function savingPerKm(from: CommuteMode, to: CommuteMode): number {
  return EMISSION_FACTORS[from].gramsPerPassengerKm - EMISSION_FACTORS[to].gramsPerPassengerKm;
}
