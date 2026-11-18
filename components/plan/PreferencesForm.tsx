"use client";

import { useId, useState } from "react";
import { PreferencesSchema, type Preferences } from "@/types/preferences";
import { Button } from "@/components/ui/Button";
import { EquipmentFields, HouseholdFields, RoutineFields } from "@/components/plan/preferences/fields";

function FormErrors({ id, errors }: { id: string; errors: readonly string[] }) {
  if (!errors.length) return null;
  return (
    <div
      id={id}
      role="alert"
      className="bg-danger-50 text-danger-700 rounded-lg border border-red-200 p-3 text-sm"
    >
      <p className="font-semibold">Please fix the following:</p>
      <ul className="mt-1 list-disc pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Optional household and routine preferences. Asks about circumstances, never medical diagnoses.
 * Stored only in this browser.
 */
export function PreferencesForm({
  initial,
  onSubmit,
}: {
  initial: Preferences;
  onSubmit: (p: Preferences) => void;
}) {
  const [draft, setDraft] = useState<Preferences>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const id = useId();
  const errorsId = `${id}-errors`;
  const update = (patch: Partial<Preferences>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = PreferencesSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => `${issue.path.join(" ")}: ${issue.message}`));
      return;
    }
    setErrors([]);
    onSubmit(parsed.data);
  };

  const fields = { id, draft, update };
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-describedby={errors.length ? errorsId : undefined}
      className="space-y-6"
    >
      <FormErrors id={errorsId} errors={errors} />
      <RoutineFields {...fields} />
      <HouseholdFields {...fields} />
      <EquipmentFields {...fields} />
      <Button type="submit">Generate my clean-air day</Button>
    </form>
  );
}
