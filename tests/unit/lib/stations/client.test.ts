import { describe, expect, it, vi } from "vitest";
import { loadStationReport } from "@/lib/stations/client";
import { DEMO_STATION_REPORT } from "@/lib/demo/stations";
import { jsonResponse } from "@/tests/fixtures/http";

const place = { latitude: 28.613939, longitude: 77.209021 };
const respond = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response);

describe("loadStationReport", () => {
  it("asks for coordinates rounded to ~1 km and returns the validated report", async () => {
    const fetchImpl = respond(jsonResponse(DEMO_STATION_REPORT));
    expect(await loadStationReport(place, { fetchImpl })).toEqual({ ok: true, report: DEMO_STATION_REPORT });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/stations?lat=28.61&lon=77.21",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("rejects a success response that fails validation", async () => {
    const result = await loadStationReport(place, { fetchImpl: respond(jsonResponse({ stations: "many" })) });
    expect(result).toMatchObject({ ok: false, code: "invalid_response" });
  });

  it("passes typed server errors through and handles unknown ones", async () => {
    const typed = jsonResponse({ error: "stations_not_configured", message: "Not set up." }, 503);
    expect(await loadStationReport(place, { fetchImpl: respond(typed) })).toEqual({
      ok: false,
      code: "stations_not_configured",
      message: "Not set up.",
    });
    const unknown = await loadStationReport(place, {
      fetchImpl: respond(new Response("<html>", { status: 500 })),
    });
    expect(unknown).toMatchObject({
      ok: false,
      code: "invalid_response",
      message: expect.stringMatching(/500/),
    });
  });

  it("reports network failures and rethrows aborts", async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    expect(await loadStationReport(place, { fetchImpl: offline })).toMatchObject({
      ok: false,
      code: "network",
    });
    const aborted = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("x", "AbortError"));
    await expect(loadStationReport(place, { fetchImpl: aborted })).rejects.toThrow();
  });
});
