"use client";

import { LoaderCircle, LocateFixed } from "lucide-react";
import { useDetectLocation } from "@/hooks/useDetectLocation";

/** Opt-in browser geolocation; the label is visually hidden on small screens but always announced. */
export function DetectLocationButton() {
  const { detect, locating } = useDetectLocation();
  return (
    <button
      type="button"
      onClick={detect}
      disabled={locating}
      className="border-line-strong bg-surface text-ink-2 hover:bg-canvas inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-70"
      title="Uses your browser's location prompt. Coordinates are rounded to about 1 km and used only to look up air data for that spot."
    >
      {locating ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <LocateFixed aria-hidden="true" className="size-4" />
      )}
      <span className="sr-only sm:not-sr-only">{locating ? "Locating…" : "Use my location"}</span>
    </button>
  );
}
