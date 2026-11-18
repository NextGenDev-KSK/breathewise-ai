"use client";

import type { ReactNode } from "react";
import { FlaskConical, MapPin, TriangleAlert } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { useDetectLocation } from "@/hooks/useDetectLocation";
import { formatAge } from "@/lib/time";

/**
 * Renders loading, empty and error states, and only calls `children` with a snapshot
 * when data is available. Shows a visible notice when a saved copy is being used.
 */
export function AirDataGate({ children }: { children: (snapshot: AirQualitySnapshot) => ReactNode }) {
  const { ready, air, refresh, updateSettings, nowMs } = useApp();
  const { detect, locating } = useDetectLocation();

  if (!ready || air.status === "loading") return <LoadingPanel />;

  if (air.status === "idle" || (!air.snapshot && air.status !== "error")) {
    return (
      <EmptyState
        icon={<MapPin className="size-6" />}
        title="Choose a location to begin"
        action={
          <>
            <Button onClick={() => document.getElementById("location-search")?.focus()}>
              Search for a city
            </Button>
            <Button variant="secondary" onClick={detect} disabled={locating}>
              {locating ? "Locating…" : "Use my location"}
            </Button>
            <Button variant="secondary" onClick={() => updateSettings({ demoMode: true })}>
              <FlaskConical aria-hidden="true" className="size-4" /> Try with sample data
            </Button>
          </>
        }
      >
        BreatheWise uses your selected city to fetch modelled air-quality data and forecasts. No account is
        needed.
      </EmptyState>
    );
  }

  if (air.status === "error" || !air.snapshot) {
    return <ErrorState message={air.error ?? "Please try again."} onRetry={refresh} />;
  }

  const s = air.snapshot;
  return (
    <>
      {s.origin === "cache" ? (
        <div
          role="alert"
          className="border-caution-200 bg-caution-50 text-caution-800 mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          <p className="flex-1">
            <strong>Showing a saved copy from {formatAge(s.fetchedAt, nowMs)}.</strong> {air.error} Timing
            advice may be out of date.
          </p>
          <Button size="sm" variant="secondary" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : null}
      {children(s)}
    </>
  );
}
