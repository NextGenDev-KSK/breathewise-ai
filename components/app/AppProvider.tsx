"use client";

import "@/lib/zodConfig";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { z } from "zod";
import type { Place } from "@/types/air";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SETTINGS,
  PreferencesSchema,
  SettingsSchema,
  type Preferences,
  type Settings,
} from "@/types/preferences";
import { useAirQuality, type AirState } from "@/hooks/useAirQuality";
import { useClock } from "@/hooks/useClock";
import { useHydrated } from "@/hooks/useHydrated";
import { useStoredState } from "@/hooks/useStoredState";
import { PlaceSchema } from "@/lib/air/snapshotSchema";
import { STORAGE_KEYS } from "@/lib/storage";
import { formatClock, type FormatTime } from "@/lib/time";

export type { AirState } from "@/hooks/useAirQuality";

interface AppContextValue {
  /** False during server render and hydration; true once stored settings are readable. */
  ready: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  place: Place | null;
  selectPlace: (place: Place) => void;
  recentPlaces: Place[];
  air: AirState;
  refresh: () => void;
  nowMs: number;
  formatTime: FormatTime;
}

const AppContext = createContext<AppContextValue | null>(null);

const NullablePlaceSchema = PlaceSchema.nullable();
const RecentPlacesSchema = z.array(PlaceSchema).max(5);
const NO_RECENT_PLACES: Place[] = [];
const MAX_RECENT_PLACES = 5;
/** Refresh "now" every minute so data-age labels and time windows stay current. */
const CLOCK_INTERVAL_MS = 60_000;

/**
 * Holds app-wide state (settings, preferences, place, air data, clock) persisted in this browser, and
 * exposes it through `useApp`.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const [settings, setSettings] = useStoredState(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS);
  const [preferences, setPreferences] = useStoredState(
    STORAGE_KEYS.preferences,
    PreferencesSchema,
    DEFAULT_PREFERENCES,
  );
  const [place, setPlace] = useStoredState<Place | null>(STORAGE_KEYS.place, NullablePlaceSchema, null);
  const [recentPlaces, setRecentPlaces] = useStoredState(
    STORAGE_KEYS.recentPlaces,
    RecentPlacesSchema,
    NO_RECENT_PLACES,
  );
  const clockMs = useClock(CLOCK_INTERVAL_MS);
  const { air, refresh } = useAirQuality({
    enabled: ready,
    place,
    demoMode: settings.demoMode,
    nowMs: clockMs,
  });
  // Never let "now" fall behind the moment the data on screen was fetched.
  const nowMs = Math.max(clockMs, air.snapshot?.fetchedAt ?? 0);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })),
    [setSettings],
  );

  const selectPlace = useCallback(
    (next: Place) => {
      setPlace(next);
      if (next.source === "search") {
        setRecentPlaces((recent) =>
          [next, ...recent.filter((p) => p.id !== next.id)].slice(0, MAX_RECENT_PLACES),
        );
      }
      // Choosing a real place always leaves demo mode, so sample and live data never mix.
      updateSettings({ demoMode: false });
    },
    [setPlace, setRecentPlaces, updateSettings],
  );

  const formatTime = useCallback<FormatTime>(
    (t) => formatClock(t, settings.timeFormat),
    [settings.timeFormat],
  );

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
    [
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** App-wide state and actions. Throws if used outside `<AppProvider>`, which is always a wiring bug. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
