"use client";

import { CloudOff, FlaskConical, RefreshCw, Signal, type LucideIcon } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { isStale } from "@/lib/engine/analysis";
import { formatAge } from "@/lib/time";
import { cn } from "@/components/ui/cn";

const FRESH_TONE = "text-brand-800 bg-brand-50 border-brand-100";
const CAUTION_TONE = "text-caution-800 bg-caution-50 border-caution-200";

interface Status {
  label: string;
  Icon: LucideIcon;
  tone: string;
}

/** Where the visible data comes from: sample data, a saved copy, stale model data or fresh model data. */
export function dataStatus(s: AirQualitySnapshot, nowMs: number): Status {
  if (s.origin === "demo") return { label: "Sample data", Icon: FlaskConical, tone: CAUTION_TONE };
  if (s.origin === "cache") {
    return { label: `Saved copy · ${formatAge(s.fetchedAt, nowMs)}`, Icon: CloudOff, tone: CAUTION_TONE };
  }
  if (isStale(s, nowMs)) {
    return { label: `Model data · ${formatAge(s.current.epochMs, nowMs)}`, Icon: Signal, tone: CAUTION_TONE };
  }
  return { label: `Model data · updated ${formatAge(s.fetchedAt, nowMs)}`, Icon: Signal, tone: FRESH_TONE };
}

/** Compact indicator of where the visible data comes from, with a refresh control. */
export function DataStatus() {
  const { air, refresh, nowMs, settings } = useApp();
  if (!air.snapshot) return null;
  const { label, Icon, tone } = dataStatus(air.snapshot, nowMs);

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap",
          tone,
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      {!settings.demoMode ? (
        <button
          type="button"
          onClick={refresh}
          disabled={air.refreshing}
          className="border-line-strong bg-surface text-ink-2 hover:bg-canvas grid size-11 place-items-center rounded-lg border disabled:opacity-70"
          aria-label={air.refreshing ? "Refreshing data" : "Refresh air-quality data"}
        >
          <RefreshCw aria-hidden="true" className={cn("size-4", air.refreshing && "animate-spin")} />
        </button>
      ) : null}
    </div>
  );
}
