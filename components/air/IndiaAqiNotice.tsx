import { ExternalLink, Info } from "lucide-react";
import { CPCB_URL } from "@/lib/engine/recommendations";

/** Explains why the Indian National AQI is not shown and where to find it. */
export function IndiaAqiNotice() {
  return (
    <aside aria-label="About India's National AQI" className="flex gap-3 rounded-xl border border-blue-100 bg-info-50 p-4 text-sm text-info-800">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">This is not India&apos;s official National AQI</p>
        <p className="mt-1 text-ink-2">
          India&apos;s National AQI (CPCB) is calculated from monitoring-station measurements and averaging periods. The values here are atmospheric-model estimates,
          shown with US and European index scales clearly labelled. BreatheWise does not calculate a CPCB AQI from model data.
        </p>
        <a href={CPCB_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-6 items-center gap-1 font-semibold text-info-800 underline underline-offset-2">
          Check official CPCB station readings <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </aside>
  );
}
