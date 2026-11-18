import { Database } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { AIR_MODELS } from "@/lib/air/models";
import { CPCB_URL } from "@/lib/content/notices";
import { EMISSION_SOURCE } from "@/lib/engine/emissions";

const LINK = "text-info-800 font-semibold";

/** Attribution and provenance for every external source the app uses. */
export function DataSources() {
  const { cams_global: global, cams_europe: europe } = AIR_MODELS;
  return (
    <Card>
      <CardHeader icon={<Database className="size-4" />} title="Data sources and attribution" />
      <div className="text-ink-2 space-y-4 p-5 text-sm">
        <section>
          <h3 className="text-ink font-semibold">Air quality: Open-Meteo Air Quality API</h3>
          <p>
            Data from{" "}
            <ExternalLink href="https://open-meteo.com/" className={LINK} showIcon={false}>
              Open-Meteo.com
            </ExternalLink>{" "}
            (CC BY 4.0, free for non-commercial use), based on Copernicus Atmosphere Monitoring Service (CAMS)
            forecasts. Contains modified Copernicus Atmosphere Monitoring Service information.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              {global.name}: {global.spatialResolution}, {global.temporalResolution}, {global.forecastLength},
              updated {global.updateFrequency}. Used for India and outside Europe.
            </li>
            <li>
              {europe.name}: {europe.spatialResolution}, {europe.temporalResolution}, {europe.forecastLength}.
              Used inside Europe.
            </li>
          </ul>
        </section>
        <section>
          <h3 className="text-ink font-semibold">Location search: Open-Meteo Geocoding API</h3>
          <p>Based on GeoNames data (CC BY 4.0).</p>
        </section>
        <section>
          <h3 className="text-ink font-semibold">Index standards</h3>
          <p>
            US AQI (US EPA) and European AQI (EEA) as calculated by Open-Meteo. Official Indian AQI readings
            are available from CPCB.
          </p>
          <ExternalLink href={CPCB_URL} className={`${LINK} mt-1`}>
            CPCB National AQI
          </ExternalLink>
        </section>
        <section>
          <h3 className="text-ink font-semibold">Commute emission factors</h3>
          <ExternalLink href={EMISSION_SOURCE.url} className={LINK}>
            {EMISSION_SOURCE.title}
          </ExternalLink>
        </section>
        <section>
          <h3 className="text-ink font-semibold">AI</h3>
          <p>
            Google Gemini (server-side only), used to explain the data in plain language. All numbers come
            from the sources above; AI output is validated before display.
          </p>
        </section>
        <p className="bg-caution-50 text-caution-800 rounded-lg p-3">
          BreatheWise provides general information, not medical advice. In a health emergency, contact local
          emergency services.
        </p>
      </div>
    </Card>
  );
}
