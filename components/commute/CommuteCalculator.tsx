"use client";

import { useId, useState } from "react";
import type { CommuteMode } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { CommuteForm } from "@/components/commute/CommuteForm";
import { CommuteResults } from "@/components/commute/CommuteResults";
import {
  calculateCommuteEmissions,
  COMMUTE_FIELDS,
  parseCommuteForm,
  type CommuteField,
  type CommuteFormValues,
  type CommuteResult,
} from "@/lib/engine/emissions";

/** Commute emissions calculator: validates the form, then shows weekly and monthly CO₂e for both modes. */
export function CommuteCalculator() {
  const { preferences } = useApp();
  const current: CommuteMode = preferences.commuteMode === "none" ? "car" : preferences.commuteMode;
  const [values, setValues] = useState<CommuteFormValues>({
    distanceKm: "10",
    tripsPerDay: "2",
    daysPerWeek: "5",
    currentMode: current,
    alternativeMode: current === "metro" ? "cycle" : "metro",
  });
  const [errors, setErrors] = useState<Partial<Record<CommuteField, string>>>({});
  const [result, setResult] = useState<CommuteResult | null>(null);
  const uid = useId();
  const fieldId = (field: CommuteField) => `${uid}-${field}`;

  const calculate = () => {
    const parsed = parseCommuteForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setResult(null);
      // Move focus to the first invalid field, in form order.
      const firstInvalid = COMMUTE_FIELDS.find((field) => parsed.errors[field] !== undefined);
      if (firstInvalid) document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    setErrors({});
    setResult(calculateCommuteEmissions(parsed.input));
  };

  return (
    <div className="space-y-6">
      <CommuteForm
        values={values}
        errors={errors}
        onChange={setValues}
        onSubmit={calculate}
        fieldId={fieldId}
      />
      <div aria-live="polite">{result ? <CommuteResults result={result} /> : null}</div>
    </div>
  );
}
