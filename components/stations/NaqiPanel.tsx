import type { z } from "zod";
import { LevelBadge } from "@/components/ui/LevelBadge";
import type { NaqiSchema } from "@/lib/stations/schema";

type Naqi = z.infer<typeof NaqiSchema>;

/** The station's CPCB National AQI, its prominent pollutant and every sub-index, or why it is missing. */
export function NaqiPanel({ naqi }: { naqi: Naqi }) {
  if (!naqi.ok) {
    return (
      <p className="border-line bg-canvas text-ink-2 rounded-xl border p-3 text-sm">
        <strong className="text-ink">National AQI not available for this station.</strong> {naqi.reason}
      </p>
    );
  }
  const pollutants = naqi.subIndices.map((s) => s.label).join(", ");
  return (
    <div className="border-line rounded-xl border p-4">
      <p className="text-ink-3 text-xs font-semibold tracking-wide uppercase">
        India National AQI (CPCB method)
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className="tabular text-ink font-[family-name:var(--font-display)] text-4xl font-bold">
          {naqi.aboveScale ? "401+" : naqi.index}
        </span>
        <LevelBadge level={naqi.level} label={naqi.category} />
        <span className="text-ink-2 text-sm">
          Prominent pollutant: <strong className="text-ink">{naqi.prominent.label}</strong>
        </span>
      </div>
      <ul className="text-ink-2 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Sub-indices">
        {naqi.subIndices.map((s) => (
          <li key={s.pollutant}>
            {s.label}{" "}
            <span className="tabular text-ink font-semibold">{s.aboveScale ? "401+" : s.index}</span>
          </li>
        ))}
      </ul>
      <p className="text-ink-3 mt-2 text-xs">
        Calculated here from the station&apos;s 24-hour averages ({pollutants}) with CPCB&apos;s breakpoints.
        CPCB&apos;s published value can differ if it includes pollutants this station does not publish in
        checkable units.
      </p>
    </div>
  );
}
