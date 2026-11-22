import { Info } from "lucide-react";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { CPCB_URL } from "@/lib/content/notices";

/** Explains that the model values are not India's National AQI, and where the station-based index is. */
export function IndiaAqiNotice() {
  return (
    <aside
      aria-label="About India's National AQI"
      className="bg-info-50 text-info-800 flex gap-3 rounded-xl border border-blue-100 p-4 text-sm"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">The values above are not India&apos;s official National AQI</p>
        <p className="text-ink-2 mt-1">
          India&apos;s National AQI (CPCB) is calculated from monitoring-station measurements and averaging
          periods. The values above are atmospheric-model estimates, shown on clearly labelled US and European
          scales; BreatheWise does not calculate a CPCB AQI from model data. The nearest monitoring stations,
          below, give a National AQI calculated with the CPCB method from their own measurements.
        </p>
        <ExternalLink href={CPCB_URL} className="text-info-800 mt-2 min-h-6 font-semibold">
          Check official CPCB station readings
        </ExternalLink>
      </div>
    </aside>
  );
}
