"use client";

import { useId, useState } from "react";
import type { Preferences } from "@/types/preferences";
import { PreferencesSchema } from "@/types/preferences";
import { Button } from "@/components/ui/Button";

const SELECT = "mt-1 block h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink";
const LABEL = "block text-sm font-medium text-ink";

function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3 py-1">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-700" aria-describedby={hint ? `${id}-hint` : undefined} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint ? (
          <span id={`${id}-hint`} className="block text-xs text-ink-3">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}

/**
 * Optional household and routine preferences. Asks about circumstances, never medical diagnoses.
 * Stored only in this browser.
 */
export function PreferencesForm({ initial, onSubmit }: { initial: Preferences; onSubmit: (p: Preferences) => void }) {
  const [draft, setDraft] = useState<Preferences>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const errorId = useId();
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = PreferencesSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(" ")}: ${i.message}`));
      return;
    }
    setErrors([]);
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={submit} noValidate aria-describedby={errors.length ? errorId : undefined} className="space-y-6">
      {errors.length ? (
        <div id={errorId} role="alert" className="rounded-lg border border-red-200 bg-danger-50 p-3 text-sm text-danger-700">
          <p className="font-semibold">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-3">Routine</legend>
        <div>
          <label className={LABEL} htmlFor="pref-routine">Daily routine</label>
          <select id="pref-routine" className={SELECT} value={draft.routine} onChange={(e) => set("routine", e.target.value as Preferences["routine"])}>
            <option value="office">Office / work outside home</option>
            <option value="student">Student</option>
            <option value="home">Mostly at home</option>
            <option value="shift">Shift work</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="pref-commute">Usual commute</label>
          <select id="pref-commute" className={SELECT} value={draft.commuteMode} onChange={(e) => set("commuteMode", e.target.value as Preferences["commuteMode"])}>
            <option value="car">Car</option>
            <option value="two_wheeler">Two-wheeler</option>
            <option value="bus">Bus</option>
            <option value="metro">Metro</option>
            <option value="walk">Walking</option>
            <option value="cycle">Cycling</option>
            <option value="none">No regular commute</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="pref-leave">Leave home at</label>
          <input id="pref-leave" type="time" className={SELECT} value={draft.leaveTime} onChange={(e) => set("leaveTime", e.target.value)} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="pref-return">Return home at</label>
          <input id="pref-return" type="time" className={SELECT} value={draft.returnTime} onChange={(e) => set("returnTime", e.target.value)} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="pref-activity">Outdoor activity habit</label>
          <select id="pref-activity" className={SELECT} value={draft.outdoorActivity} onChange={(e) => set("outdoorActivity", e.target.value as Preferences["outdoorActivity"])}>
            <option value="walking">Walking</option>
            <option value="jogging">Jogging / running</option>
            <option value="cycling">Cycling</option>
            <option value="exercise">Outdoor exercise</option>
            <option value="children_play">Children&apos;s outdoor play</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="pref-when">Preferred activity time</label>
          <select id="pref-when" className={SELECT} value={draft.preferredActivityTime} onChange={(e) => set("preferredActivityTime", e.target.value as Preferences["preferredActivityTime"])}>
            <option value="flexible">Flexible</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-3">Household (optional)</legend>
        <p className="mb-2 text-xs text-ink-3">Used only to add extra caution. No health details are asked or stored.</p>
        <div className="grid sm:grid-cols-3">
          <Checkbox label="Children" checked={draft.household.children} onChange={(v) => set("household", { ...draft.household, children: v })} />
          <Checkbox label="Older adults" checked={draft.household.olderAdults} onChange={(v) => set("household", { ...draft.household, olderAdults: v })} />
          <Checkbox label="Someone sensitive to air pollution" checked={draft.household.respiratorySensitivity} onChange={(v) => set("household", { ...draft.household, respiratorySensitivity: v })} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-3">Home equipment</legend>
        <div>
          <Checkbox label="Air purifier with HEPA filter" checked={draft.equipment.airPurifier} onChange={(v) => set("equipment", { ...draft.equipment, airPurifier: v })} />
          <Checkbox label="Kitchen exhaust vented outdoors" checked={draft.equipment.kitchenExhaust} onChange={(v) => set("equipment", { ...draft.equipment, kitchenExhaust: v })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="pref-fuel">Main cooking fuel</label>
          <select id="pref-fuel" className={SELECT} value={draft.cookingFuel} onChange={(e) => set("cookingFuel", e.target.value as Preferences["cookingFuel"])}>
            <option value="gas">LPG / piped gas</option>
            <option value="electric">Electric / induction</option>
            <option value="biomass">Wood, coal or other solid fuel</option>
            <option value="unknown">Prefer not to say</option>
          </select>
        </div>
      </fieldset>

      <Button type="submit">Generate my clean-air day</Button>
    </form>
  );
}
