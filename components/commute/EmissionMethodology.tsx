import { COMMUTE_MODES } from "@/types/preferences";
import { Card, CardHeader } from "@/components/ui/Card";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { EMISSION_FACTORS, EMISSION_SOURCE } from "@/lib/engine/emissions";

/** The emission-factor table and formulas, so every number on the page can be checked. */
export function EmissionMethodology() {
  return (
    <Card>
      <CardHeader
        title="Methodology and assumptions"
        description="Every number above comes from this table."
      />
      <div className="text-ink-2 space-y-4 p-5 text-sm">
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Emission factors (scrollable)"
        >
          <table className="w-full min-w-[30rem] text-left">
            <caption className="sr-only">Emission factors used by the calculator</caption>
            <thead className="text-ink-3 text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Mode
                </th>
                <th scope="col" className="py-2 pr-3">
                  g CO₂e / passenger-km
                </th>
                <th scope="col" className="py-2">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {COMMUTE_MODES.map((mode) => (
                <tr key={mode} className="border-line border-t">
                  <th scope="row" className="text-ink py-2 pr-3 font-medium">
                    {EMISSION_FACTORS[mode].label}
                  </th>
                  <td className="tabular py-2 pr-3">≈ {EMISSION_FACTORS[mode].gramsPerPassengerKm}</td>
                  <td className="py-2 text-xs">{EMISSION_FACTORS[mode].note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Weekly emissions = factor × one-way distance × trips per day × days per week.</li>
          <li>Monthly = weekly × 52 ÷ 12. All results are rounded.</li>
          <li>
            Factors are illustrative life-cycle values from an Indian case study. Real emissions depend on
            vehicle, fuel, occupancy, traffic and the electricity grid.
          </li>
          <li>
            Walking and cycling are counted as zero direct operational emissions in this simplified
            comparison.
          </li>
        </ul>
        <p>
          Source:{" "}
          <ExternalLink href={EMISSION_SOURCE.url} className="text-info-800 font-semibold">
            {EMISSION_SOURCE.title}
          </ExternalLink>
        </p>
      </div>
    </Card>
  );
}
