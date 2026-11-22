import type { Place } from "@/types/air";
import {
  StationErrorSchema,
  StationReportSchema,
  type StationErrorCode,
  type StationReport,
} from "@/lib/stations/schema";

/** Why station data is not available: a server error code, or a client-side failure. */
export type StationFailureCode = StationErrorCode | "network" | "invalid_response";

export type StationResult =
  { ok: true; report: StationReport } | { ok: false; code: StationFailureCode; message: string };

/** Options for {@link loadStationReport}; `fetchImpl` is injected in tests. */
export interface LoadStationOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/**
 * Asks our server for nearby monitoring stations and re-validates the answer before it can be shown.
 * Coordinates are rounded to ~1 km here as well as on the server. Aborts are rethrown so a newer
 * request can replace this one silently.
 */
export async function loadStationReport(
  place: Pick<Place, "latitude" | "longitude">,
  { signal, fetchImpl = fetch }: LoadStationOptions = {},
): Promise<StationResult> {
  const params = new URLSearchParams({ lat: place.latitude.toFixed(2), lon: place.longitude.toFixed(2) });
  let res: Response;
  try {
    res = await fetchImpl(`/api/stations?${params.toString()}`, { signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, code: "network", message: "The monitoring-station service could not be reached." };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const report = StationReportSchema.safeParse(body);
    return report.success
      ? { ok: true, report: report.data }
      : { ok: false, code: "invalid_response", message: "Station data did not pass validation." };
  }
  const failure = StationErrorSchema.safeParse(body);
  return failure.success
    ? { ok: false, code: failure.data.error, message: failure.data.message }
    : { ok: false, code: "invalid_response", message: `The station service returned status ${res.status}.` };
}
