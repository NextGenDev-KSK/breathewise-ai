"use client";

import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { InputField, SelectField } from "@/components/ui/FormField";
import type { CommuteField, CommuteFormValues } from "@/lib/engine/emissions";
import { MODE_OPTIONS } from "@/components/commute/modeOptions";

interface CommuteFormProps {
  values: CommuteFormValues;
  errors: Partial<Record<CommuteField, string>>;
  onChange: (values: CommuteFormValues) => void;
  onSubmit: () => void;
  /** Builds the DOM id of a field, so the parent can move focus to the first invalid one. */
  fieldId: (field: CommuteField) => string;
}

/** Controlled commute inputs (distance, trips, days and both modes) with per-field error messages. */
export function CommuteForm({ values, errors, onChange, onSubmit, fieldId }: CommuteFormProps) {
  const set = <K extends keyof CommuteFormValues>(key: K, value: CommuteFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <Card>
      <CardHeader
        icon={<Calculator className="size-4" />}
        title="Compare commute emissions"
        description="Estimate life-cycle CO₂e for your regular trips and a lower-emission alternative."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        noValidate
        className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <InputField
          id={fieldId("distanceKm")}
          label="One-way trip distance (km)"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={values.distanceKm}
          onValueChange={(v) => set("distanceKm", v)}
          hint="0.1 to 200 km"
          error={errors.distanceKm}
        />
        <InputField
          id={fieldId("tripsPerDay")}
          label="Trips per day"
          type="number"
          inputMode="numeric"
          step="1"
          value={values.tripsPerDay}
          onValueChange={(v) => set("tripsPerDay", v)}
          hint="e.g. 2 for there and back"
          error={errors.tripsPerDay}
        />
        <InputField
          id={fieldId("daysPerWeek")}
          label="Commuting days per week"
          type="number"
          inputMode="numeric"
          step="1"
          value={values.daysPerWeek}
          onValueChange={(v) => set("daysPerWeek", v)}
          hint="1 to 7"
          error={errors.daysPerWeek}
        />
        <SelectField
          id={fieldId("currentMode")}
          label="Current transport"
          value={values.currentMode}
          options={MODE_OPTIONS}
          onChange={(mode) => set("currentMode", mode)}
        />
        <SelectField
          id={fieldId("alternativeMode")}
          label="Alternative to compare"
          value={values.alternativeMode}
          options={MODE_OPTIONS}
          onChange={(mode) => set("alternativeMode", mode)}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Calculate
          </Button>
        </div>
      </form>
    </Card>
  );
}
