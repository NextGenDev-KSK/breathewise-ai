"use client";

import { SlidersHorizontal } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

const INDEX_OPTIONS = [
  { value: "us", label: "US AQI (EPA)" },
  { value: "eu", label: "European AQI (EEA)" },
] as const;

const TIME_OPTIONS = [
  { value: "24h", label: "24-hour" },
  { value: "12h", label: "12-hour" },
] as const;

/** Settings that change how the app behaves; each one has a visible effect elsewhere. */
export function PreferenceSettings() {
  const { settings, updateSettings } = useApp();
  const toast = useToast();
  return (
    <Card>
      <CardHeader icon={<SlidersHorizontal className="size-4" />} title="Preferences" />
      <div className="space-y-6 p-5">
        <SegmentedControl
          legend="Primary index standard"
          hint="Which index is shown first on the dashboard. India's CPCB AQI is not available from model data."
          value={settings.aqiStandard}
          options={INDEX_OPTIONS}
          onChange={(aqiStandard) => updateSettings({ aqiStandard })}
        />
        <SegmentedControl
          legend="Time format"
          hint="Used for forecast times and recommendations."
          value={settings.timeFormat}
          options={TIME_OPTIONS}
          onChange={(timeFormat) => updateSettings({ timeFormat })}
        />
        <Switch
          label="Use AI (Gemini) for assistant answers"
          hint="When on, your question, city name, current readings and saved preferences are sent to Google Gemini. When off, answers come from the on-device rule engine only."
          checked={settings.aiEnabled}
          onChange={(aiEnabled) => updateSettings({ aiEnabled })}
        />
        <Switch
          label="Demo mode (sample data)"
          hint="Replaces live data with clearly labelled sample values for demonstrations. Live data is never mixed with sample data."
          checked={settings.demoMode}
          onChange={(demoMode) => {
            updateSettings({ demoMode });
            toast(
              demoMode ? "Demo mode on: showing SAMPLE data." : "Demo mode off: showing live model data.",
              "info",
            );
          }}
        />
      </div>
    </Card>
  );
}
