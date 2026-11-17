"use client";

import { useId, useState } from "react";
import { Calculator, ExternalLink, Leaf } from "lucide-react";
import { COMMUTE_MODES, type CommuteMode } from "@/types/preferences";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import {
  CommuteInputSchema,
  EMISSION_FACTORS,
  EMISSION_SOURCE,
  WEEKS_PER_MONTH,
  calculateCommuteEmissions,
  type CommuteResult,
} from "@/lib/engine/emissions";

type Field = "distanceKm" | "tripsPerDay" | "daysPerWeek" | "currentMode" | "alternativeMode";

const kg = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: v < 10 ? 2 : 1 })} kg CO₂e`;

export function CommuteCalculator() {
  const { preferences } = useApp();
  const defaultCurrent: CommuteMode = preferences.commuteMode === "none" ? "car" : preferences.commuteMode;
  const [form, setForm] = useState({
    distanceKm: "10",
    tripsPerDay: "2",
    daysPerWeek: "5",
    currentMode: defaultCurrent,
    alternativeMode: (defaultCurrent === "metro" ? "cycle" : "metro") as CommuteMode,
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [result, setResult] = useState<CommuteResult | null>(null);
  const uid = useId();
  const fid = (f: Field) => `${uid}-${f}`;

  function calculate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CommuteInputSchema.safeParse({
      distanceKm: form.distanceKm.trim() === "" ? undefined : Number(form.distanceKm),
      tripsPerDay: form.tripsPerDay.trim() === "" ? undefined : Number(form.tripsPerDay),
      daysPerWeek: form.daysPerWeek.trim() === "" ? undefined : Number(form.daysPerWeek),
      currentMode: form.currentMode,
      alternativeMode: form.alternativeMode,
    });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field;
        next[key] ??= issue.message;
      }
      setErrors(next);
      setResult(null);
      document.getElementById(fid(Object.keys(next)[0] as Field))?.focus();
      return;
    }
    setErrors({});
    setResult(calculateCommuteEmissions(parsed.data));
  }

  const numberField = (f: "distanceKm" | "tripsPerDay" | "daysPerWeek", label: string, hint: string, step: string) => (
    <div>
      <label htmlFor={fid(f)} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={fid(f)}
        type="number"
        inputMode="decimal"
        step={step}
        value={form[f]}
        onChange={(e) => setForm({ ...form, [f]: e.target.value })}
        aria-invalid={errors[f] ? true : undefined}
        aria-describedby={`${fid(f)}-hint${errors[f] ? ` ${fid(f)}-err` : ""}`}
        className={cn("mt-1 h-11 w-full rounded-lg border px-3 text-sm", errors[f] ? "border-danger-700" : "border-line-strong")}
      />
      <p id={`${fid(f)}-hint`} className="mt-1 text-xs text-ink-3">
        {hint}
      </p>
      {errors[f] ? (
        <p id={`${fid(f)}-err`} className="mt-1 text-xs font-semibold text-danger-700">
          {errors[f]}
        </p>
      ) : null}
    </div>
  );

  const modeField = (f: "currentMode" | "alternativeMode", label: string) => (
    <div>
      <label htmlFor={fid(f)} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select id={fid(f)} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value as CommuteMode })} className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm">
        {COMMUTE_MODES.map((m) => (
          <option key={m} value={m}>
            {EMISSION_FACTORS[m].label}
          </option>
        ))}
      </select>
    </div>
  );

  const max = result ? Math.max(result.current.weeklyKg, result.alternative.weeklyKg, 0.001) : 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={<Calculator className="size-4" />} title="Compare commute emissions" description="Estimate life-cycle CO₂e for your regular trips and a lower-emission alternative." />
        <form onSubmit={calculate} noValidate className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {numberField("distanceKm", "One-way trip distance (km)", "0.1 to 200 km", "0.1")}
          {numberField("tripsPerDay", "Trips per day", "e.g. 2 for there and back", "1")}
          {numberField("daysPerWeek", "Commuting days per week", "1 to 7", "1")}
          {modeField("currentMode", "Current transport")}
          {modeField("alternativeMode", "Alternative to compare")}
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Calculate
            </Button>
          </div>
        </form>
      </Card>

      <div aria-live="polite">
        {result ? (
          <Card>
            <CardHeader icon={<Leaf className="size-4" />} title="Estimated emissions" description={`${result.weeklyKm.toLocaleString("en-IN")} passenger-km per week.`} />
            <div className="space-y-5 p-5">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-canvas p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Weekly difference</dt>
                  <dd className="tabular mt-1 text-2xl font-bold text-ink" data-testid="weekly-saving">
                    {result.weeklySavingKg >= 0 ? kg(result.weeklySavingKg) : `+${kg(-result.weeklySavingKg)}`}
                  </dd>
                  <dd className="text-xs text-ink-3">{result.weeklySavingKg > 0 ? "estimated saving" : result.weeklySavingKg < 0 ? "more than current" : "no difference"}</dd>
                </div>
                <div className="rounded-xl bg-canvas p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Monthly difference</dt>
                  <dd className="tabular mt-1 text-2xl font-bold text-ink" data-testid="monthly-saving">
                    {result.monthlySavingKg >= 0 ? kg(result.monthlySavingKg) : `+${kg(-result.monthlySavingKg)}`}
                  </dd>
                  <dd className="text-xs text-ink-3">weekly × {WEEKS_PER_MONTH.toFixed(2)}</dd>
                </div>
                <div className="rounded-xl bg-canvas p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Relative change</dt>
                  <dd className="tabular mt-1 text-2xl font-bold text-ink">{result.relativeChange === null ? "Not applicable" : `${Math.round(result.relativeChange * 100)}%`}</dd>
                  <dd className="text-xs text-ink-3">alternative vs current</dd>
                </div>
              </dl>

              <div className="space-y-3" role="group" aria-label="Weekly emissions comparison">
                {[
                  { name: `Current: ${EMISSION_FACTORS[result.current.mode].label}`, v: result.current, cls: "bg-ink-3" },
                  { name: `Alternative: ${EMISSION_FACTORS[result.alternative.mode].label}`, v: result.alternative, cls: "bg-brand-600" },
                ].map((row) => (
                  <div key={row.name}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium text-ink">{row.name}</span>
                      <span className="tabular text-ink-2">
                        {kg(row.v.weeklyKg)}/week · {kg(row.v.monthlyKg)}/month
                      </span>
                    </div>
                    <div className="mt-1 h-3 rounded-full bg-canvas" aria-hidden="true">
                      <div className={cn("h-full rounded-full", row.cls)} style={{ width: `${Math.max(1, (row.v.weeklyKg / max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="rounded-lg bg-info-50 px-3 py-2 text-sm text-info-800">
                This compares greenhouse-gas (CO₂e) estimates. It is not the same as local air pollution: a CO₂e saving does not translate into a measurable change in your city&apos;s AQI. Open-air modes (walking, cycling, two-wheeler) also mean breathing roadside air directly; check the forecast for cleaner hours.
              </p>
            </div>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader title="Methodology and assumptions" description="Every number above comes from this table." />
        <div className="space-y-4 p-5 text-sm text-ink-2">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Emission factors (scrollable)">
            <table className="w-full min-w-[30rem] text-left">
              <caption className="sr-only">Emission factors used by the calculator</caption>
              <thead className="text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th scope="col" className="py-2 pr-3">Mode</th>
                  <th scope="col" className="py-2 pr-3">g CO₂e / passenger-km</th>
                  <th scope="col" className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {COMMUTE_MODES.map((m) => (
                  <tr key={m} className="border-t border-line">
                    <th scope="row" className="py-2 pr-3 font-medium text-ink">{EMISSION_FACTORS[m].label}</th>
                    <td className="tabular py-2 pr-3">≈ {EMISSION_FACTORS[m].gramsPerPassengerKm}</td>
                    <td className="py-2 text-xs">{EMISSION_FACTORS[m].note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1 pl-5">
            <li>Weekly emissions = factor × one-way distance × trips per day × days per week.</li>
            <li>Monthly = weekly × 52 ÷ 12. All results are rounded.</li>
            <li>Factors are illustrative life-cycle values from an Indian case study. Real emissions depend on vehicle, fuel, occupancy, traffic and the electricity grid.</li>
            <li>Walking and cycling are counted as zero direct operational emissions in this simplified comparison.</li>
          </ul>
          <p>
            Source:{" "}
            <a href={EMISSION_SOURCE.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-info-800 underline underline-offset-2">
              {EMISSION_SOURCE.title} <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
