import { z } from "zod";
import { COMMUTE_MODES, type CommuteMode } from "@/types/preferences";
import { EMISSION_FACTORS, WEEKS_PER_MONTH } from "@/lib/engine/emissions";
import { firstErrorPerField, numberOrUndefined } from "@/lib/engine/forms";

/**
 * "Combine errands": several separate round trips from home replaced by one combined loop. Every
 * distance is the user's own estimate; nothing is inferred about routes.
 */
export const ErrandInputSchema = z.object({
  trips: z
    .number({ error: "Enter how many separate trips you make." })
    .int("Trips must be a whole number.")
    .min(2, "Combining needs at least 2 trips.")
    .max(20, "At most 20 trips."),
  roundTripKm: z
    .number({ error: "Enter the round-trip distance of a typical errand." })
    .min(0.1, "At least 0.1 km.")
    .max(100, "At most 100 km."),
  combinedKm: z
    .number({ error: "Enter the length of one combined trip." })
    .min(0.1, "At least 0.1 km.")
    .max(300, "At most 300 km."),
  timesPerWeek: z
    .number({ error: "Enter how often you run these errands." })
    .int("Use a whole number.")
    .min(1, "At least once a week.")
    .max(7, "At most 7 times a week."),
  mode: z.enum(COMMUTE_MODES),
});
export type ErrandInput = z.infer<typeof ErrandInputSchema>;

export const ERRAND_FIELDS = ["trips", "roundTripKm", "combinedKm", "timesPerWeek", "mode"] as const;
export type ErrandField = (typeof ERRAND_FIELDS)[number];

/** Raw form values: numbers are still text, exactly as typed. */
export interface ErrandFormValues {
  trips: string;
  roundTripKm: string;
  combinedKm: string;
  timesPerWeek: string;
  mode: CommuteMode;
}

export type ErrandFormResult =
  { ok: true; input: ErrandInput } | { ok: false; errors: Partial<Record<ErrandField, string>> };

/** Validates typed form values; on failure returns the first error message for each field. */
export function parseErrandForm(form: ErrandFormValues): ErrandFormResult {
  const parsed = ErrandInputSchema.safeParse({
    ...form,
    trips: numberOrUndefined(form.trips),
    roundTripKm: numberOrUndefined(form.roundTripKm),
    combinedKm: numberOrUndefined(form.combinedKm),
    timesPerWeek: numberOrUndefined(form.timesPerWeek),
  });
  if (parsed.success) return { ok: true, input: parsed.data };
  return { ok: false, errors: firstErrorPerField(parsed.error.issues, ERRAND_FIELDS) };
}

export interface ErrandResult {
  /** Kilometres a week as separate trips and as one combined trip. */
  separateKmWeek: number;
  combinedKmWeek: number;
  /** Positive when combining is shorter. */
  savedKmWeek: number;
  savedKmMonth: number;
  /** Life-cycle CO₂e avoided, kg (0 for zero-emission modes). */
  savedKgWeek: number;
  savedKgMonth: number;
  /** Vehicle trips started from home avoided each week. */
  tripsAvoidedWeek: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Distance and CO₂e saved by running the errands as one combined trip instead of separate ones. */
export function combineErrands({
  trips,
  roundTripKm,
  combinedKm,
  timesPerWeek,
  mode,
}: ErrandInput): ErrandResult {
  const separateKmWeek = trips * roundTripKm * timesPerWeek;
  const combinedKmWeek = combinedKm * timesPerWeek;
  const savedKmWeek = separateKmWeek - combinedKmWeek;
  const kgPerKm = EMISSION_FACTORS[mode].gramsPerPassengerKm / 1000;
  return {
    separateKmWeek: round1(separateKmWeek),
    combinedKmWeek: round1(combinedKmWeek),
    savedKmWeek: round1(savedKmWeek),
    savedKmMonth: round1(savedKmWeek * WEEKS_PER_MONTH),
    savedKgWeek: round2(savedKmWeek * kgPerKm),
    savedKgMonth: round2(savedKmWeek * WEEKS_PER_MONTH * kgPerKm),
    tripsAvoidedWeek: (trips - 1) * timesPerWeek,
  };
}
