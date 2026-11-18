"use client";

import { useId } from "react";
import type { Preferences } from "@/types/preferences";
import { InputField, SelectField, type SelectOption } from "@/components/ui/FormField";

const ROUTINE_OPTIONS: readonly SelectOption<Preferences["routine"]>[] = [
  { value: "office", label: "Office / work outside home" },
  { value: "student", label: "Student" },
  { value: "home", label: "Mostly at home" },
  { value: "shift", label: "Shift work" },
];

const COMMUTE_OPTIONS: readonly SelectOption<Preferences["commuteMode"]>[] = [
  { value: "car", label: "Car" },
  { value: "two_wheeler", label: "Two-wheeler" },
  { value: "bus", label: "Bus" },
  { value: "metro", label: "Metro" },
  { value: "walk", label: "Walking" },
  { value: "cycle", label: "Cycling" },
  { value: "none", label: "No regular commute" },
];

const ACTIVITY_OPTIONS: readonly SelectOption<Preferences["outdoorActivity"]>[] = [
  { value: "walking", label: "Walking" },
  { value: "jogging", label: "Jogging / running" },
  { value: "cycling", label: "Cycling" },
  { value: "exercise", label: "Outdoor exercise" },
  { value: "children_play", label: "Children's outdoor play" },
  { value: "none", label: "None" },
];

const ACTIVITY_TIME_OPTIONS: readonly SelectOption<Preferences["preferredActivityTime"]>[] = [
  { value: "flexible", label: "Flexible" },
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
];

const FUEL_OPTIONS: readonly SelectOption<Preferences["cookingFuel"]>[] = [
  { value: "gas", label: "LPG / piped gas" },
  { value: "electric", label: "Electric / induction" },
  { value: "biomass", label: "Wood, coal or other solid fuel" },
  { value: "unknown", label: "Prefer not to say" },
];

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3 py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-brand-700 mt-0.5 size-5 shrink-0"
      />
      <label htmlFor={id} className="text-ink text-sm">
        {label}
      </label>
    </div>
  );
}

const LEGEND = "mb-2 text-sm font-semibold tracking-wide text-ink-3 uppercase";

/** Shared props for each fieldset: the form's id prefix, the current draft and a patch setter. */
export interface FieldsetProps {
  id: string;
  draft: Preferences;
  update: (patch: Partial<Preferences>) => void;
}

/** Daily routine, commute, leave and return times, and outdoor activity habit. */
export function RoutineFields({ id, draft, update }: FieldsetProps) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className={LEGEND}>Routine</legend>
      <SelectField
        id={`${id}-routine`}
        label="Daily routine"
        value={draft.routine}
        options={ROUTINE_OPTIONS}
        onChange={(routine) => update({ routine })}
      />
      <SelectField
        id={`${id}-commute`}
        label="Usual commute"
        value={draft.commuteMode}
        options={COMMUTE_OPTIONS}
        onChange={(commuteMode) => update({ commuteMode })}
      />
      <InputField
        id={`${id}-leave`}
        label="Leave home at"
        type="time"
        required
        value={draft.leaveTime}
        onValueChange={(leaveTime) => update({ leaveTime })}
      />
      <InputField
        id={`${id}-return`}
        label="Return home at"
        type="time"
        required
        value={draft.returnTime}
        onValueChange={(returnTime) => update({ returnTime })}
      />
      <SelectField
        id={`${id}-activity`}
        label="Outdoor activity habit"
        value={draft.outdoorActivity}
        options={ACTIVITY_OPTIONS}
        onChange={(outdoorActivity) => update({ outdoorActivity })}
      />
      <SelectField
        id={`${id}-when`}
        label="Preferred activity time"
        value={draft.preferredActivityTime}
        options={ACTIVITY_TIME_OPTIONS}
        onChange={(preferredActivityTime) => update({ preferredActivityTime })}
      />
    </fieldset>
  );
}

/** Optional household circumstances that add caution. Asks about people, never health conditions. */
export function HouseholdFields({ draft, update }: FieldsetProps) {
  const setHousehold = (patch: Partial<Preferences["household"]>) =>
    update({ household: { ...draft.household, ...patch } });
  return (
    <fieldset>
      <legend className="text-ink-3 mb-1 text-sm font-semibold tracking-wide uppercase">
        Household (optional)
      </legend>
      <p className="text-ink-3 mb-2 text-xs">
        Used only to add extra caution. No health details are asked or stored.
      </p>
      <div className="grid sm:grid-cols-3">
        <Checkbox
          label="Children"
          checked={draft.household.children}
          onChange={(children) => setHousehold({ children })}
        />
        <Checkbox
          label="Older adults"
          checked={draft.household.olderAdults}
          onChange={(olderAdults) => setHousehold({ olderAdults })}
        />
        <Checkbox
          label="Someone sensitive to air pollution"
          checked={draft.household.respiratorySensitivity}
          onChange={(respiratorySensitivity) => setHousehold({ respiratorySensitivity })}
        />
      </div>
    </fieldset>
  );
}

/** Air purifier, kitchen exhaust and cooking fuel, used for indoor advice. */
export function EquipmentFields({ id, draft, update }: FieldsetProps) {
  const setEquipment = (patch: Partial<Preferences["equipment"]>) =>
    update({ equipment: { ...draft.equipment, ...patch } });
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className={LEGEND}>Home equipment</legend>
      <div>
        <Checkbox
          label="Air purifier with HEPA filter"
          checked={draft.equipment.airPurifier}
          onChange={(airPurifier) => setEquipment({ airPurifier })}
        />
        <Checkbox
          label="Kitchen exhaust vented outdoors"
          checked={draft.equipment.kitchenExhaust}
          onChange={(kitchenExhaust) => setEquipment({ kitchenExhaust })}
        />
      </div>
      <SelectField
        id={`${id}-fuel`}
        label="Main cooking fuel"
        value={draft.cookingFuel}
        options={FUEL_OPTIONS}
        onChange={(cookingFuel) => update({ cookingFuel })}
      />
    </fieldset>
  );
}
