import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAirQuality } from "@/hooks/useAirQuality";
import { normalizeAirQuality } from "@/lib/air/openMeteo";
import { STORAGE_KEYS, writeStored } from "@/lib/storage";
import { DELHI, DELHI_NOW, delhiRaw } from "@/tests/fixtures/builders";
import { jsonResponse } from "@/tests/fixtures/http";

describe("useAirQuality", () => {
  const options = { enabled: true, place: DELHI, demoMode: false, nowMs: DELHI_NOW };

  it("loads, then succeeds with live data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(delhiRaw)));
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
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
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(delhiRaw));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAirQuality(options));
    await waitFor(() => expect(result.current.air.status).toBe("success"));
    act(() => result.current.refresh());
    expect(result.current.air).toMatchObject({ status: "success", refreshing: true });
    await waitFor(() => expect(result.current.air.refreshing).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("serves a repeated place from the cache without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(delhiRaw));
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
