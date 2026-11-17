"use client";

import { useId, useState } from "react";
import { Database, ExternalLink, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { clearAllStored } from "@/lib/storage";
import { clearCache } from "@/lib/air/cache";
import { EMISSION_SOURCE } from "@/lib/engine/emissions";
import { CPCB_URL } from "@/lib/engine/recommendations";
import { AIR_MODELS } from "@/lib/air/models";

function Segmented<T extends string>({ legend, value, options, onChange, hint }: { legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint: string }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <p className="text-xs text-ink-3">{hint}</p>
      <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-canvas p-1">
        {options.map((o) => (
          <label key={o.value} className={cn("flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-info-700", value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3")}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        <p id={`${id}-h`} className="text-xs text-ink-3">
          {hint}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-h`}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors", checked ? "border-brand-700 bg-brand-700" : "border-ink-3 bg-surface")}
      >
        <span aria-hidden="true" className={cn("inline-block size-5 rounded-full transition-transform", checked ? "translate-x-5 bg-white" : "translate-x-0.5 bg-ink-3")} />
      </button>
    </div>
  );
}

export function SettingsPanel() {
  const { settings, updateSettings } = useApp();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={<SlidersHorizontal className="size-4" />} title="Preferences" />
        <div className="space-y-6 p-5">
          <Segmented
            legend="Primary index standard"
            hint="Which index is shown first on the dashboard. India's CPCB AQI is not available from model data."
            value={settings.aqiStandard}
            options={[{ value: "us", label: "US AQI (EPA)" }, { value: "eu", label: "European AQI (EEA)" }]}
            onChange={(v) => updateSettings({ aqiStandard: v })}
          />
          <Segmented
            legend="Time format"
            hint="Used for forecast times and recommendations."
            value={settings.timeFormat}
            options={[{ value: "24h", label: "24-hour" }, { value: "12h", label: "12-hour" }]}
            onChange={(v) => updateSettings({ timeFormat: v })}
          />
          <Toggle
            label="Use AI (Gemini) for assistant answers"
            hint="When on, your question, city name, current readings and saved preferences are sent to Google Gemini. When off, answers come from the on-device rule engine only."
            checked={settings.aiEnabled}
            onChange={(v) => updateSettings({ aiEnabled: v })}
          />
          <Toggle
            label="Demo mode (sample data)"
            hint="Replaces live data with clearly labelled sample values for demonstrations. Live data is never mixed with sample data."
            checked={settings.demoMode}
            onChange={(v) => {
              updateSettings({ demoMode: v });
              toast(v ? "Demo mode on: showing SAMPLE data." : "Demo mode off: showing live model data.", "info");
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<ShieldCheck className="size-4" />} title="Privacy" />
        <div className="space-y-3 p-5 text-sm text-ink-2">
          <ul className="list-disc space-y-1 pl-5">
            <li>No account, no tracking, no analytics.</li>
            <li>Settings, preferences, checklist and mission progress are stored only in this browser (localStorage).</li>
            <li>Detected location is rounded to about 1 km and used only to request air-quality data from Open-Meteo.</li>
            <li>The AI assistant never receives your coordinates. Conversations are not stored.</li>
          </ul>
          <Button variant="secondary" onClick={() => setConfirmClear(true)}>
            <Trash2 aria-hidden="true" className="size-4" /> Clear all local data
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Database className="size-4" />} title="Data sources and attribution" />
        <div className="space-y-4 p-5 text-sm text-ink-2">
          <div>
            <h3 className="font-semibold text-ink">Air quality: Open-Meteo Air Quality API</h3>
            <p>
              Data from{" "}
              <a className="font-semibold text-info-800 underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
                Open-Meteo.com
              </a>{" "}
              (CC BY 4.0, free for non-commercial use), based on Copernicus Atmosphere Monitoring Service (CAMS) forecasts. Contains modified Copernicus Atmosphere Monitoring Service information.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{AIR_MODELS.cams_global.name}: {AIR_MODELS.cams_global.spatialResolution}, {AIR_MODELS.cams_global.temporalResolution}, {AIR_MODELS.cams_global.forecastLength}, updated {AIR_MODELS.cams_global.updateFrequency}. Used for India and outside Europe.</li>
              <li>{AIR_MODELS.cams_europe.name}: {AIR_MODELS.cams_europe.spatialResolution}, {AIR_MODELS.cams_europe.temporalResolution}, {AIR_MODELS.cams_europe.forecastLength}. Used inside Europe.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-ink">Location search: Open-Meteo Geocoding API</h3>
            <p>Based on GeoNames data (CC BY 4.0).</p>
          </div>
          <div>
            <h3 className="font-semibold text-ink">Index standards</h3>
            <p>US AQI (US EPA) and European AQI (EEA) as calculated by Open-Meteo. Official Indian AQI readings are available from CPCB.</p>
            <a className="mt-1 inline-flex items-center gap-1 font-semibold text-info-800 underline" href={CPCB_URL} target="_blank" rel="noopener noreferrer">
              CPCB National AQI <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
          <div>
            <h3 className="font-semibold text-ink">Commute emission factors</h3>
            <a className="inline-flex items-center gap-1 font-semibold text-info-800 underline" href={EMISSION_SOURCE.url} target="_blank" rel="noopener noreferrer">
              {EMISSION_SOURCE.title} <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
          <div>
            <h3 className="font-semibold text-ink">AI</h3>
            <p>Google Gemini (server-side only), used to explain the data in plain language. All numbers come from the sources above; AI output is validated before display.</p>
          </div>
          <p className="rounded-lg bg-caution-50 p-3 text-caution-800">BreatheWise provides general information, not medical advice. In a health emergency, contact local emergency services.</p>
        </div>
      </Card>

      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all local data?" description="This removes your location, preferences, checklist, mission progress and saved data from this browser.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              clearAllStored();
              clearCache();
              // A full reload is intentional: it discards all in-memory state along with storage.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/");
            }}
          >
            Clear data
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
