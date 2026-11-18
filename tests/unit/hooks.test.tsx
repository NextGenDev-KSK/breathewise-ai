import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { z } from "zod";
import { useStoredState } from "@/hooks/useStoredState";
import { useHydrated } from "@/hooks/useHydrated";
import { useAirQuality } from "@/hooks/useAirQuality";
import { useCitySearch, searchStatusText } from "@/hooks/useCitySearch";
import { clearCache } from "@/lib/air/cache";
import { normalizeAirQuality } from "@/lib/air/openMeteo";
import {
  clearAllStored,
  readStored,
  STORAGE_KEYS,
  storedSnapshotReader,
  subscribeToStorage,
  writeStored,
} from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { DELHI, DELHI_NOW, delhiRaw } from "../fixtures/builders";
import pune from "../fixtures/geocoding-pune.json";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => clearCache());
afterEach(() => vi.unstubAllGlobals());

describe("storage store", () => {
  it("notifies subscribers on write and clear, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);
    writeStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    clearAllStored();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    writeStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reacts to changes from other tabs, ignoring unrelated keys", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "breathewise:v1:settings" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "another-app" }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("returns the same object until the stored text changes", () => {
    const read = storedSnapshotReader(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS);
    writeStored(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, demoMode: true });
    const first = read();
    expect(read()).toBe(first);
    writeStored(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, demoMode: false });
    expect(read()).not.toBe(first);
    expect(read().demoMode).toBe(false);
  });
});

describe("useStoredState", () => {
  const Schema = z.object({ count: z.number() });
  const fallback = { count: 0 };

  it("persists updates and accepts updater functions", () => {
    const { result } = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    expect(result.current[0]).toEqual({ count: 0 });
    act(() => result.current[1]({ count: 2 }));
    act(() => result.current[1]((previous) => ({ count: previous.count + 1 })));
    expect(result.current[0]).toEqual({ count: 3 });
    expect(readStored(STORAGE_KEYS.mission, Schema, fallback)).toEqual({ count: 3 });
  });

  it("keeps two components on the same key in sync and resets on clear", () => {
    const a = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    const b = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    act(() => a.result.current[1]({ count: 7 }));
    expect(b.result.current[0]).toEqual({ count: 7 });
    act(() => clearAllStored());
    expect(a.result.current[0]).toEqual(fallback);
  });

  it("falls back for invalid stored data", () => {
    localStorage.setItem("breathewise:v1:mission", JSON.stringify({ count: "x" }));
    const { result } = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    expect(result.current[0]).toBe(fallback);
  });
});

describe("useHydrated", () => {
  it("is true after hydration on the client", () => {
    expect(renderHook(() => useHydrated()).result.current).toBe(true);
  });
});

describe("useAirQuality", () => {
  const options = { enabled: true, place: DELHI, demoMode: false, nowMs: DELHI_NOW };

  it("loads, then succeeds with live data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(delhiRaw)));
    const { result } = renderHook(() => useAirQuality(options));
    expect(result.current.air.status).toBe("loading");
    await waitFor(() => expect(result.current.air.status).toBe("success"));
    expect(result.current.air.snapshot?.current.usAqi).toBe(152);
    expect(result.current.air.snapshot?.origin).toBe("live");
  });

  it("is idle without a place and loading until enabled", () => {
    expect(renderHook(() => useAirQuality({ ...options, place: null })).result.current.air.status).toBe(
      "idle",
    );
    expect(renderHook(() => useAirQuality({ ...options, enabled: false })).result.current.air.status).toBe(
      "loading",
    );
  });

  it("reports an error when the API fails and nothing is saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 500)));
    const { result } = renderHook(() => useAirQuality(options));
    await waitFor(() => expect(result.current.air.status).toBe("error"));
    expect(result.current.air.error).toMatch(/status 500/);
  });

  it("falls back to a labelled saved copy for the same place", async () => {
    writeStored(STORAGE_KEYS.lastSnapshot, normalizeAirQuality(delhiRaw, DELHI, "cams_global", DELHI_NOW));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { result } = renderHook(() => useAirQuality(options));
    await waitFor(() => expect(result.current.air.status).toBe("success"));
    expect(result.current.air.snapshot?.origin).toBe("cache");
    expect(result.current.air.error).toMatch(/Could not reach/);
  });

  it("keeps showing data while refreshing, then fetches again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(delhiRaw));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAirQuality(options));
    await waitFor(() => expect(result.current.air.status).toBe("success"));
    act(() => result.current.refresh());
    expect(result.current.air).toMatchObject({ status: "success", refreshing: true });
    await waitFor(() => expect(result.current.air.refreshing).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("serves a repeated place from the cache without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(delhiRaw));
    vi.stubGlobal("fetch", fetchMock);
    const first = renderHook(() => useAirQuality(options));
    await waitFor(() => expect(first.result.current.air.status).toBe("success"));
    const second = renderHook(() => useAirQuality(options));
    await waitFor(() => expect(second.result.current.air.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows labelled sample data in demo mode without any request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAirQuality({ ...options, demoMode: true }));
    expect(result.current.air.snapshot?.origin).toBe("demo");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useCitySearch", () => {
  it("debounces, and only shows results for the current query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(pune));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ input }) => useCitySearch(input), {
      initialProps: { input: "P" },
    });
    expect(result.current.status).toBe("idle");
    rerender({ input: "Pun" });
    rerender({ input: "Pune" });
    expect(result.current.status).toBe("searching");
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.results[0]?.name).toBe("Pune");
    expect(searchStatusText(result.current)).toMatch(/3 locations found/);
    rerender({ input: "Puneville" });
    expect(result.current).toMatchObject({ status: "searching", results: [] });
  });

  it("reports failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { result } = renderHook(() => useCitySearch("Pune"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(searchStatusText(result.current)).toMatch(/unavailable/);
  });
});
