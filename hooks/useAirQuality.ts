"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AirQualitySnapshot, Place } from "@/types/air";
import { invalidateCached, loadAirQuality, savedSnapshotFor } from "@/lib/air/cache";
import { AirQualityError } from "@/lib/air/openMeteo";
import { buildDemoSnapshot } from "@/lib/demo/fixture";

export type AirStatus = "idle" | "loading" | "success" | "error";

export interface AirState {
  status: AirStatus;
  snapshot: AirQualitySnapshot | null;
  /** Set on failure; also set alongside a saved copy when fresh data could not be loaded. */
  error: string | null;
  /** True while newer data is loading for the place already on screen. */
  refreshing: boolean;
}

interface LoadResult {
  key: string;
  snapshot: AirQualitySnapshot | null;
  error: string | null;
}

interface Options {
  /** False until stored settings are readable (after hydration). */
  enabled: boolean;
  place: Place | null;
  demoMode: boolean;
  nowMs: number;
}

const IDLE: AirState = { status: "idle", snapshot: null, error: null, refreshing: false };
const LOADING: AirState = { status: "loading", snapshot: null, error: null, refreshing: false };

function messageFor(error: unknown): string {
  return error instanceof AirQualityError
    ? error.message
    : "Something went wrong while loading air-quality data.";
}

/**
 * Loads air-quality data for the selected place. Each place change or refresh starts a new
 * request and aborts the previous one, so stale responses never overwrite fresh ones.
 * Demo mode never fetches: it shows clearly labelled sample data instead.
 */
export function useAirQuality({ enabled, place, demoMode, nowMs }: Options) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestKey = enabled && place && !demoMode ? `${place.id}#${reloadToken}` : null;

  useEffect(() => {
    if (!requestKey || !place) return;
    const controller = new AbortController();
    loadAirQuality(place, controller.signal)
      .then((snapshot) => setResult({ key: requestKey, snapshot, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, snapshot: savedSnapshotFor(place), error: messageFor(error) });
      });
    return () => controller.abort();
  }, [requestKey, place]);

  const refresh = useCallback(() => {
    if (place) invalidateCached(place);
    setReloadToken((token) => token + 1);
  }, [place]);

  const demoSnapshot = useMemo(() => (demoMode ? buildDemoSnapshot(nowMs) : null), [demoMode, nowMs]);

  const air = useMemo<AirState>(() => {
    if (demoSnapshot) return { status: "success", snapshot: demoSnapshot, error: null, refreshing: false };
    if (!enabled) return LOADING;
    if (!place || !requestKey) return IDLE;
    if (result?.key === requestKey) {
      return result.snapshot
        ? { status: "success", snapshot: result.snapshot, error: result.error, refreshing: false }
        : { status: "error", snapshot: null, error: result.error, refreshing: false };
    }
    // A newer request is in flight: keep showing this place's previous data while refreshing.
    if (result?.snapshot?.place.id === place.id) {
      return { status: "success", snapshot: result.snapshot, error: null, refreshing: true };
    }
    return LOADING;
  }, [demoSnapshot, enabled, place, requestKey, result]);

  return { air, refresh };
}
