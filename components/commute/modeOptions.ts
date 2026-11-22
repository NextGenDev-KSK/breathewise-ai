import { COMMUTE_MODES } from "@/types/preferences";
import { EMISSION_FACTORS } from "@/lib/engine/emissions";

/** Travel modes for select inputs, labelled as in the emission-factor table. */
export const MODE_OPTIONS = COMMUTE_MODES.map((mode) => ({
  value: mode,
  label: EMISSION_FACTORS[mode].label,
}));
