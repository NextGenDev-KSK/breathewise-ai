"use client";

import "@/lib/zodConfig";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import type { AirQualitySnapshot, Place } from "@/types/air";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SETTINGS,
  PreferencesSchema,
  SettingsSchema,
  type Preferences,
  type Settings,
} from "@/types/preferences";
import { usePersistentState } from "@/hooks/usePersistentState";
import { AirQualityError, fetchAirQuality } from "@/lib/air/openMeteo";
import { getCached, setCached } from "@/lib/air/cache";
import { PlaceSchema, SnapshotSchema } from "@/lib/air/snapshotSchema";
import { buildDemoSnapshot } from "@/lib/demo/fixture";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";
import { formatClock } from "@/lib/time";

export type AirStatus = "idle" | "loading" | "success" | "error";

export interface AirState {
  status: AirStatus;
  snapshot: AirQualitySnapshot | null;
  error: string | null;
  refreshing: boolean;
}

interface AppContextValue {
  ready: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  place: Place | null;
  selectPlace: (p: Place) => void;
  recentPlaces: Place[];
  air: AirState;
  refresh: () => void;
  nowMs: number;
  formatTime: (localTime: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

const NullablePlace = PlaceSchema.nullable();
const RecentPlaces = z.array(PlaceSchema).max(5);
const RECENT_FALLBACK: Place[] = [];

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings, settingsLoaded] = usePersistentState(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS);
  const [preferences, setPreferences, prefsLoaded] = usePersistentState(STORAGE_KEYS.preferences, PreferencesSchema, DEFAULT_PREFERENCES);
  const [place, setPlace, placeLoaded] = usePersistentState<Place | null>(STORAGE_KEYS.place, NullablePlace, null);
  const [recentPlaces, setRecentPlaces] = usePersistentState(STORAGE_KEYS.recentPlaces, RecentPlaces, RECENT_FALLBACK);
  const [air, setAir] = useState<AirState>({ status: "idle", snapshot: null, error: null, refreshing: false });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reloadToken, setReloadToken] = useState(0);
  const forceRef = useRef(false);

  const ready = settingsLoaded && prefsLoaded && placeLoaded;

  // Keep "now" roughly current so time windows and data-age labels stay correct (every 5 min).
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    /* eslint-disable react-hooks/set-state-in-effect -- syncing with an external data source */
    setNowMs(now);
    if (settings.demoMode) {
      // Demo mode never mixes with live data: sample data replaces it entirely.
      setAir({ status: "success", snapshot: buildDemoSnapshot(now), error: null, refreshing: false });
      return;
    }
    if (!place) {
      setAir({ status: "idle", snapshot: null, error: null, refreshing: false });
      return;
    }
    const force = forceRef.current;
    forceRef.current = false;
    const cached = force ? null : getCached(place, now);
    if (cached) {
      setAir({ status: "success", snapshot: cached, error: null, refreshing: false });
      return;
    }
    setAir((prev) => {
      const samePlace = prev.snapshot?.place.id === place.id && prev.snapshot.origin !== "demo";
      return samePlace ? { ...prev, refreshing: true, error: null } : { status: "loading", snapshot: null, error: null, refreshing: false };
    });
    /* eslint-enable react-hooks/set-state-in-effect */

    // A newer location change aborts this request, so stale responses never overwrite fresh ones.
    const controller = new AbortController();
    fetchAirQuality(place, { signal: controller.signal })
      .then((snapshot) => {
        setCached(snapshot);
        writeStored(STORAGE_KEYS.lastSnapshot, snapshot);
        setAir({ status: "success", snapshot, error: null, refreshing: false });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof AirQualityError && err.kind === "aborted")) return;
        const message = err instanceof AirQualityError ? err.message : "Something went wrong while loading air-quality data.";
        const saved = readStored(STORAGE_KEYS.lastSnapshot, SnapshotSchema.nullable(), null);
        if (saved && saved.place.id === place.id) {
          setAir({ status: "success", snapshot: { ...saved, origin: "cache" }, error: message, refreshing: false });
        } else {
          setAir({ status: "error", snapshot: null, error: message, refreshing: false });
        }
      });
    return () => controller.abort();
  }, [ready, place, settings.demoMode, reloadToken]);

  const selectPlace = useCallback(
    (p: Place) => {
      setPlace(p);
      if (p.source === "search") {
        setRecentPlaces((prev) => [p, ...prev.filter((x) => x.id !== p.id)].slice(0, 5));
      }
      if (settings.demoMode) setSettings((s) => ({ ...s, demoMode: false }));
    },
    [setPlace, setRecentPlaces, settings.demoMode, setSettings],
  );

  const refresh = useCallback(() => {
    forceRef.current = true;
    setReloadToken((t) => t + 1);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);

  const formatTime = useCallback((t: string) => formatClock(t, settings.timeFormat), [settings.timeFormat]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      settings,
      updateSettings,
      preferences,
      setPreferences,
      place,
      selectPlace,
      recentPlaces,
      air,
      refresh,
      nowMs,
      formatTime,
    }),
    [ready, settings, updateSettings, preferences, setPreferences, place, selectPlace, recentPlaces, air, refresh, nowMs, formatTime],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
