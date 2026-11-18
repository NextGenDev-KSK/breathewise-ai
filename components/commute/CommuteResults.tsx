import type { ReactNode } from "react";
import { Leaf } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { EMISSION_FACTORS, WEEKS_PER_MONTH, type CommuteResult } from "@/lib/engine/emissions";

/** "13.8 kg CO₂e", with more decimals for small values. */
function formatKg(value: number): string {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: value < 10 ? 2 : 1 })} kg CO₂e`;
}

/** A saving shows as-is; an increase is prefixed with "+" so it reads as more emissions. */
function formatDifference(savingKg: number): string {
  return savingKg >= 0 ? formatKg(savingKg) : `+${formatKg(-savingKg)}`;
}

function savingLabel(savingKg: number): string {
  if (savingKg > 0) return "estimated saving";
  if (savingKg < 0) return "more than current";
  return "no difference";
}

function Metric({
  label,
  value,
  note,
  testId,
}: {
  label: string;
  value: ReactNode;
  note: string;
  testId?: string;
}) {
  return (
    <div className="bg-canvas rounded-xl p-4">
      <dt className="text-ink-3 text-xs font-semibold tracking-wide uppercase">{label}</dt>
      <dd className="tabular text-ink mt-1 text-2xl font-bold" data-testid={testId}>
        {value}
      </dd>
      <dd className="text-ink-3 text-xs">{note}</dd>
    </div>
  );
}

/** Weekly and monthly CO₂e for the current and alternative modes, side by side. */
export function CommuteResults({ result }: { result: CommuteResult }) {
  const maxWeekly = Math.max(result.current.weeklyKg, result.alternative.weeklyKg, 0.001);
  const rows = [
    {
      name: `Current: ${EMISSION_FACTORS[result.current.mode].label}`,
      mode: result.current,
      bar: "bg-ink-3",
    },
    {
      name: `Alternative: ${EMISSION_FACTORS[result.alternative.mode].label}`,
      mode: result.alternative,
      bar: "bg-brand-600",
    },
  ];
  return (
    <Card>
      <CardHeader
        icon={<Leaf className="size-4" />}
        title="Estimated emissions"
        description={`${result.weeklyKm.toLocaleString("en-IN")} passenger-km per week.`}
      />
      <div className="space-y-5 p-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Weekly difference"
            value={formatDifference(result.weeklySavingKg)}
            note={savingLabel(result.weeklySavingKg)}
            testId="weekly-saving"
          />
          <Metric
            label="Monthly difference"
            value={formatDifference(result.monthlySavingKg)}
            note={`weekly × ${WEEKS_PER_MONTH.toFixed(2)}`}
            testId="monthly-saving"
          />
          <Metric
            label="Relative change"
            value={
              result.relativeChange === null
                ? "Not applicable"
                : `${Math.round(result.relativeChange * 100)}%`
            }
            note="alternative vs current"
          />
        </dl>
        <div className="space-y-3" role="group" aria-label="Weekly emissions comparison">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-ink font-medium">{row.name}</span>
                <span className="tabular text-ink-2">
                  {formatKg(row.mode.weeklyKg)}/week · {formatKg(row.mode.monthlyKg)}/month
                </span>
              </div>
              <div className="bg-canvas mt-1 h-3 rounded-full" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", row.bar)}
                  style={{ width: `${Math.max(1, (row.mode.weeklyKg / maxWeekly) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="bg-info-50 text-info-800 rounded-lg px-3 py-2 text-sm">
          This compares greenhouse-gas (CO₂e) estimates. It is not the same as local air pollution: a CO₂e
          saving does not translate into a measurable change in your city&apos;s AQI. Open-air modes (walking,
          cycling, two-wheeler) also mean breathing roadside air directly; check the forecast for cleaner
          hours.
        </p>
      </div>
    </Card>
  );
}
