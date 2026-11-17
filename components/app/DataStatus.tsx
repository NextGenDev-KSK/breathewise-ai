"use client";

import { CloudOff, FlaskConical, RefreshCw, Signal } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { isStale } from "@/lib/engine/analysis";
import { formatAge } from "@/lib/time";
import { cn } from "@/components/ui/cn";

/** Compact indicator of where the visible data comes from, with a refresh control. */
export function DataStatus() {
  const { air, refresh, nowMs, settings } = useApp();
  const s = air.snapshot;
  if (!s) return null;

  let label: string;
  let Icon = Signal;
  let tone = "text-brand-800 bg-brand-50 border-brand-100";
  if (s.origin === "demo") {
    label = "Sample data";
    Icon = FlaskConical;
    tone = "text-caution-800 bg-caution-50 border-caution-200";
  } else if (s.origin === "cache") {
    label = `Saved copy · ${formatAge(s.fetchedAt, nowMs)}`;
    Icon = CloudOff;
    tone = "text-caution-800 bg-caution-50 border-caution-200";
  } else if (isStale(s, nowMs)) {
    label = `Model data · ${formatAge(s.current.epochMs, nowMs)}`;
    tone = "text-caution-800 bg-caution-50 border-caution-200";
  } else {
    label = `Model data · updated ${formatAge(s.fetchedAt, nowMs)}`;
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold", tone)}>
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      {!settings.demoMode ? (
        <button
          type="button"
          onClick={refresh}
          disabled={air.refreshing}
          className="grid size-11 place-items-center rounded-lg border border-line-strong bg-surface text-ink-2 hover:bg-canvas disabled:opacity-70"
          aria-label={air.refreshing ? "Refreshing data" : "Refresh air-quality data"}
        >
          <RefreshCw aria-hidden="true" className={cn("size-4", air.refreshing && "animate-spin")} />
        </button>
      ) : null}
    </div>
  );
}
