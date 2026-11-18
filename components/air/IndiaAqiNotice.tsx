import { Info } from "lucide-react";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { CPCB_URL } from "@/lib/content/notices";

/** Explains why the Indian National AQI is not shown and where to find it. */
export function IndiaAqiNotice() {
  return (
    <aside
      aria-label="About India's National AQI"
      className="bg-info-50 text-info-800 flex gap-3 rounded-xl border border-blue-100 p-4 text-sm"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">This is not India&apos;s official National AQI</p>
        <p className="text-ink-2 mt-1">
          India&apos;s National AQI (CPCB) is calculated from monitoring-station measurements and averaging
          periods. The values here are atmospheric-model estimates, shown with US and European index scales
          clearly labelled. BreatheWise does not calculate a CPCB AQI from model data.
        </p>
        <ExternalLink href={CPCB_URL} className="text-info-800 mt-2 min-h-6 font-semibold">
          Check official CPCB station readings
        </ExternalLink>
      </div>
    </aside>
  );
}
