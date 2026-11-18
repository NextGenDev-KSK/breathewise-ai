"use client";

import { FlaskConical } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";

/** Persistent label shown on every screen while demo mode is on. */
export function DemoBanner() {
  const { settings, updateSettings } = useApp();
  if (!settings.demoMode) return null;
  return (
    <div role="note" aria-label="Demo mode" className="border-caution-200 bg-caution-50 border-b">
      <div className="text-caution-800 mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm lg:px-8">
        <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
        <p className="flex-1">
          <strong className="font-bold tracking-wide">SAMPLE DATA · DEMO MODE</strong>
          <span className="ml-2">Values are illustrative and are not real readings or forecasts.</span>
        </p>
        <button
          type="button"
          onClick={() => updateSettings({ demoMode: false })}
          className="border-caution-800/30 bg-surface hover:bg-caution-50 min-h-9 rounded-md border px-3 font-semibold"
        >
          Exit demo
        </button>
      </div>
    </div>
  );
}
