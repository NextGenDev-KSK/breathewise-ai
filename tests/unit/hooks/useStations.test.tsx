import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStations } from "@/hooks/useStations";
import { DEMO_STATION_REPORT } from "@/lib/demo/stations";
import { DELHI } from "@/tests/fixtures/builders";
import { jsonResponse } from "@/tests/fixtures/http";

const options = { enabled: true, place: DELHI, demoMode: false };

describe("useStations", () => {
  it("shows the labelled sample in demo mode without fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useStations({ ...options, demoMode: true }));
    expect(result.current).toEqual({ status: "success", report: DEMO_STATION_REPORT, sample: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is idle without a place and loading until enabled", () => {
    expect(renderHook(() => useStations({ ...options, place: null })).result.current.status).toBe("idle");
    expect(renderHook(() => useStations({ ...options, enabled: false })).result.current.status).toBe(
      "loading",
    );
  });

  it("loads, then succeeds with live station data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DEMO_STATION_REPORT)));
    const { result } = renderHook(() => useStations(options));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current).toMatchObject({ sample: false, report: { source: "OpenAQ" } });
  });

  it("reports the server's reason when station data is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "stations_rate_limited", message: "Busy." }, 503)),
    );
    const { result } = renderHook(() => useStations(options));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ code: "stations_rate_limited", message: "Busy." });
  });
});
