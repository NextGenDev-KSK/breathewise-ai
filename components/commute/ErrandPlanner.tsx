"use client";

import { useId, useState } from "react";
import { Route } from "lucide-react";
import type { CommuteMode } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { InputField, SelectField } from "@/components/ui/FormField";
import { MODE_OPTIONS } from "@/components/commute/modeOptions";
import { EMISSION_FACTORS } from "@/lib/engine/emissions";
import {
  combineErrands,
  ERRAND_FIELDS,
  parseErrandForm,
  type ErrandField,
  type ErrandFormValues,
  type ErrandResult,
} from "@/lib/engine/errands";

const kg = (value: number) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg CO₂e`;
const km = (value: number) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km`;

function ErrandOutcome({ result, mode }: { result: ErrandResult; mode: CommuteMode }) {
  if (result.savedKmWeek <= 0) {
    return (
      <p className="text-ink-2 text-sm">
        One combined trip would be as long as the separate ones ({km(result.combinedKmWeek)} vs{" "}
        {km(result.separateKmWeek)} a week), so combining saves no distance here. Walking or cycling the short
        ones would.
      </p>
    );
  }
  const zeroEmission = EMISSION_FACTORS[mode].gramsPerPassengerKm === 0;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-ink text-base font-semibold" data-testid="errand-saving">
        Combining saves {km(result.savedKmWeek)} a week ({km(result.savedKmMonth)} a month)
        {zeroEmission ? "." : `, about ${kg(result.savedKgMonth)} a month.`}
      </p>
      <p className="text-ink-2">
        {km(result.separateKmWeek)} a week as separate trips becomes {km(result.combinedKmWeek)} as one trip,
        with {result.tripsAvoidedWeek} fewer departures from home. Fewer trips also mean less time in traffic
        air on high-pollution days.
      </p>
      <p className="text-ink-3 text-xs">
        Saving = (trips × round trip − combined trip) × times a week, ×{" "}
        {EMISSION_FACTORS[mode].gramsPerPassengerKm} g CO₂e/km for{" "}
        {EMISSION_FACTORS[mode].label.toLowerCase()} (illustrative case-study factor). Distances are your own
        estimates.
      </p>
    </div>
  );
}

/**
 * "Combine errands": compares several separate round trips with one combined loop, the expert's example of
 * a low-emission routine change, and shows the distance and CO₂e it saves.
 */
export function ErrandPlanner() {
  const { preferences } = useApp();
  const preferred = preferences.commuteMode;
  const [values, setValues] = useState<ErrandFormValues>({
    trips: "3",
    roundTripKm: "6",
    combinedKm: "10",
    timesPerWeek: "1",
    mode: preferred === "none" || preferred === "walk" || preferred === "cycle" ? "car" : preferred,
  });
  const [errors, setErrors] = useState<Partial<Record<ErrandField, string>>>({});
  const [result, setResult] = useState<ErrandResult | null>(null);
  const uid = useId();
  const fieldId = (field: ErrandField) => `${uid}-${field}`;
  const set = <K extends keyof ErrandFormValues>(key: K, value: ErrandFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const estimate = () => {
    const parsed = parseErrandForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setResult(null);
      const firstInvalid = ERRAND_FIELDS.find((field) => parsed.errors[field] !== undefined);
      if (firstInvalid) document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    setErrors({});
    setResult(combineErrands(parsed.input));
  };

  const number = (field: Exclude<ErrandField, "mode">, label: string, hint: string, step = "1") => (
    <InputField
      id={fieldId(field)}
      label={label}
      type="number"
      inputMode={step === "1" ? "numeric" : "decimal"}
      step={step}
      value={values[field]}
      onValueChange={(v) => set(field, v)}
      hint={hint}
      error={errors[field]}
    />
  );

  return (
    <Card>
      <CardHeader
        icon={<Route className="size-4" />}
        title="Combine errands"
        description="Running several errands in one trip, instead of a separate round trip for each, cuts distance and emissions."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          estimate();
        }}
        noValidate
        className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {number("trips", "Separate errand trips", "e.g. 3: market, pharmacy, school pick-up")}
        {number("roundTripKm", "Round trip for each (km)", "Typical distance there and back", "0.1")}
        {number("combinedKm", "One combined trip (km)", "Your estimate of one loop to all stops", "0.1")}
        {number("timesPerWeek", "How often a week", "1 to 7")}
        <SelectField
          id={fieldId("mode")}
          label="Travel mode"
          value={values.mode}
          options={MODE_OPTIONS}
          onChange={(mode) => set("mode", mode)}
        />
        <div className="flex items-end">
          <Button type="submit">Estimate saving</Button>
        </div>
      </form>
      <div aria-live="polite" className="px-5 pb-5 empty:hidden">
        {result ? <ErrandOutcome result={result} mode={values.mode} /> : null}
      </div>
    </Card>
  );
}
