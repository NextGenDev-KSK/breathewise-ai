"use client";

import { useEffect, useMemo, useState } from "react";
import type { Place } from "@/types/air";
import { loadStationReport, type StationFailureCode, type StationResult } from "@/lib/stations/client";
import type { StationReport } from "@/lib/stations/schema";
import { DEMO_STATION_REPORT } from "@/lib/demo/stations";

/** Station data for the selected place; `sample` marks the labelled demo capture. */
export type StationsState =
  | { status: "idle" | "loading" }
  | { status: "success"; report: StationReport; sample: boolean }
  | { status: "error"; code: StationFailureCode; message: string };

interface Options {
  /** False until stored settings are readable (after hydration). */
  enabled: boolean;
  place: Place | null;
  demoMode: boolean;
}

const IDLE: StationsState = { status: "idle" };
const LOADING: StationsState = { status: "loading" };
const SAMPLE: StationsState = { status: "success", report: DEMO_STATION_REPORT, sample: true };

/**
 * Loads nearby monitoring stations for the selected place, one request per place (a newer place
 * aborts the older request). Demo mode shows the labelled sample capture and never fetches.
 */
export function useStations({ enabled, place, demoMode }: Options): StationsState {
  const [result, setResult] = useState<{ key: string; value: StationResult } | null>(null);
  const requestKey = enabled && place && !demoMode ? place.id : null;

  useEffect(() => {
    if (!requestKey || !place) return;
    const controller = new AbortController();
    loadStationReport(place, { signal: controller.signal })
      .then((value) => setResult({ key: requestKey, value }))
      .catch(() => undefined); // only aborts reject: a newer place replaced this request
    return () => controller.abort();
  }, [requestKey, place]);

  return useMemo<StationsState>(() => {
    if (demoMode) return SAMPLE;
    if (!enabled) return LOADING;
    if (!requestKey) return IDLE;
    if (result?.key !== requestKey) return LOADING;
    const { value } = result;
    return value.ok
      ? { status: "success", report: value.report, sample: false }
      : { status: "error", code: value.code, message: value.message };
  }, [demoMode, enabled, requestKey, result]);
}
