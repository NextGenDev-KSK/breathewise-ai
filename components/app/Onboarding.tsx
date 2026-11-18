"use client";

import { FlaskConical, LocateFixed, Search } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useDetectLocation } from "@/hooks/useDetectLocation";

/** First-visit introduction. Explains what the app does and how data is handled. */
export function Onboarding() {
  const { ready, settings, updateSettings, place } = useApp();
  const { detect } = useDetectLocation();
  const open = ready && !settings.onboarded && !place;

  const finish = (patch: Partial<typeof settings> = {}) => updateSettings({ onboarded: true, ...patch });
  const focusSearch = () => {
    finish();
    window.setTimeout(() => document.getElementById("location-search")?.focus(), 50);
  };

  return (
    <Dialog
      open={open}
      onClose={() => finish()}
      title="Welcome to BreatheWise AI"
      description="Understand the air. Make smarter choices. Breathe better."
    >
      <ul className="text-ink-2 space-y-3 text-sm">
        <li>
          <strong className="text-ink">See what the air is like</strong>, which pollutant matters most, and
          when it is forecast to be comparatively cleaner.
        </li>
        <li>
          <strong className="text-ink">Get explained actions</strong> for outdoor timing, your home, your
          commute and your family, each showing why it was suggested.
        </li>
        <li>
          <strong className="text-ink">Private by design:</strong> no account, preferences stay in this
          browser, and location is only used if you allow it.
        </li>
      </ul>
      <p className="bg-info-50 text-info-800 mt-4 rounded-lg p-3 text-xs">
        Data comes from Copernicus (CAMS) atmospheric models via Open-Meteo. It is a model estimate, not an
        official monitoring-station reading.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <Button onClick={focusSearch}>
          <Search aria-hidden="true" className="size-4" /> Search city
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            finish();
            detect();
          }}
        >
          <LocateFixed aria-hidden="true" className="size-4" /> My location
        </Button>
        <Button variant="secondary" onClick={() => finish({ demoMode: true })}>
          <FlaskConical aria-hidden="true" className="size-4" /> Try demo
        </Button>
      </div>
    </Dialog>
  );
}
