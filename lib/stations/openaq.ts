import "server-only";
import { z } from "zod";
import { HOUR_MS } from "@/lib/time";
import { computeNaqi, missingRequirement, type NaqiPollutant } from "@/lib/stations/naqi";
import type { Station, StationReading, StationReport } from "@/lib/stations/schema";

/**
 * Server-side client for OpenAQ v3, which republishes India's CPCB and state-board station data
 * (and other networks worldwide). The API key never leaves the server.
 */

const BASE_URL = "https://api.openaq.org/v3";
/** OpenAQ's maximum search radius. */
const RADIUS_M = 25_000;
/** A station counts as active if it reported within this window. */
export const ACTIVE_WITHIN_MS = 3 * HOUR_MS;
const MAX_STATIONS = 3;
/** Stations tried, nearest first, to find one with enough data for the National AQI. */
const NAQI_CANDIDATES = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const HOURS_IN_DAY = 24;

/** OpenAQ parameter names mapped to the pollutants the CPCB index uses. */
const PARAMETERS: Readonly<Record<string, NaqiPollutant>> = {
  pm25: "pm2_5",
  pm10: "pm10",
  no2: "nitrogen_dioxide",
  so2: "sulphur_dioxide",
  o3: "ozone",
  co: "carbon_monoxide",
  nh3: "ammonia",
};

/**
 * Only streams labelled µg/m³ are used. Some CPCB streams are labelled "ppb" although their values match
 * CPCB's µg/m³ and mg/m³ figures, so converting them would risk a unit error.
 */
const MICROGRAMS = /^[µμ]g\/m³$/;

const SensorSchema = z.object({
  id: z.number().int(),
  parameter: z.object({ name: z.string(), units: z.string() }),
});
type Sensor = z.infer<typeof SensorSchema>;

const LocationSchema = z.object({
  id: z.number().int(),
  name: z.string().nullish(),
  country: z.object({ code: z.string().nullish() }).nullish(),
  provider: z.object({ name: z.string().nullish() }).nullish(),
  isMobile: z.boolean().nullish(),
  /** True for reference-grade monitors; false for low-cost sensors. */
  isMonitor: z.boolean().nullish(),
  distance: z.number().nullish(),
  datetimeLast: z.object({ utc: z.iso.datetime() }).nullish(),
  sensors: z.array(SensorSchema).default([]),
});
type Location = z.infer<typeof LocationSchema>;

const ResultsSchema = z.object({ results: z.array(z.unknown()) });
const LatestSchema = z.object({
  sensorsId: z.number().int(),
  value: z.number(),
  datetime: z.object({ utc: z.iso.datetime() }),
});
const HourSchema = z.object({
  value: z.number().nullable(),
  period: z.object({ datetimeFrom: z.object({ utc: z.iso.datetime() }) }),
});

/** Why OpenAQ data could not be loaded. Carries no upstream text, so it is safe to log. */
export class OpenAqError extends Error {
  constructor(readonly kind: "timeout" | "rate-limited" | "unavailable") {
    super(`OpenAQ ${kind}`);
    this.name = "OpenAqError";
  }
}

/** The OpenAQ API key from the environment, or null when station data is not configured. */
export function readOpenAqKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const key = env.OPENAQ_API_KEY?.trim() ?? "";
  return key.length > 0 ? key : null;
}

interface Client {
  key: string;
  fetchImpl: typeof fetch;
}

/** GETs one OpenAQ path and returns the items of its `results` array that match `schema`. */
async function getResults<T>(client: Client, path: string, schema: z.ZodType<T>): Promise<T[]> {
  let res: Response;
  try {
    res = await client.fetchImpl(`${BASE_URL}${path}`, {
      headers: { "X-API-Key": client.key, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new OpenAqError(
      error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "unavailable",
    );
  }
  if (res.status === 429) throw new OpenAqError("rate-limited");
  if (!res.ok) throw new OpenAqError("unavailable");
  const body = ResultsSchema.safeParse(await res.json().catch(() => null));
  if (!body.success) throw new OpenAqError("unavailable");
  // One malformed item should not hide every other station.
  return body.data.results.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function toStation(location: Location): Station | null {
  const lastUpdated = location.datetimeLast?.utc;
  // Only fixed, reference-grade monitors: the CPCB index is defined for them, not for low-cost sensors.
  if (location.isMobile || location.isMonitor !== true) return null;
  if (typeof location.distance !== "number" || !lastUpdated) return null;
  return {
    id: location.id,
    name: (location.name ?? "").trim().slice(0, 120) || `Station ${location.id}`,
    provider: (location.provider?.name ?? "Unknown network").slice(0, 80),
    countryCode: (location.country?.code ?? "").slice(0, 3),
    distanceKm: Math.round(location.distance / 100) / 10,
    lastUpdated,
  };
}

/** Fixed reference monitors within 25 km that reported recently, nearest first. */
async function activeStations(client: Client, lat: number, lon: number, nowMs: number) {
  const locations = await getResults(
    client,
    `/locations?coordinates=${lat},${lon}&radius=${RADIUS_M}&monitor=true&limit=100`,
    LocationSchema,
  );
  return locations
    .map((location) => ({ location, station: toStation(location) }))
    .filter((entry): entry is { location: Location; station: Station } => entry.station !== null)
    .filter(({ station }) => nowMs - Date.parse(station.lastUpdated) <= ACTIVE_WITHIN_MS)
    .sort((a, b) => a.station.distanceKm - b.station.distanceKm);
}

/** Values in CPCB units: µg/m³, except CO in mg/m³. */
function toCpcbUnits(pollutant: NaqiPollutant, microgramsPerM3: number): number {
  return pollutant === "carbon_monoxide" ? microgramsPerM3 / 1000 : microgramsPerM3;
}

interface CurrentSensor {
  sensorId: number;
  reading: StationReading;
}

/** For each pollutant, the µg/m³ sensor with the newest recent reading at this station. */
async function currentSensors(client: Client, location: Location, nowMs: number): Promise<CurrentSensor[]> {
  const sensors = new Map<number, Sensor>(location.sensors.map((s) => [s.id, s]));
  const latest = await getResults(client, `/locations/${location.id}/latest`, LatestSchema);
  const newest = new Map<NaqiPollutant, CurrentSensor>();
  for (const { sensorsId, value, datetime } of latest) {
    const sensor = sensors.get(sensorsId);
    const pollutant = sensor && PARAMETERS[sensor.parameter.name];
    const measuredMs = Date.parse(datetime.utc);
    if (!sensor || !pollutant || !MICROGRAMS.test(sensor.parameter.units) || value < 0) continue;
    if (nowMs - measuredMs > ACTIVE_WITHIN_MS) continue;
    const previous = newest.get(pollutant);
    if (previous && Date.parse(previous.reading.measuredAt) >= measuredMs) continue;
    const unit = pollutant === "carbon_monoxide" ? "mg/m³" : "µg/m³";
    newest.set(pollutant, {
      sensorId: sensorsId,
      reading: { pollutant, value: toCpcbUnits(pollutant, value), unit, measuredAt: datetime.utc },
    });
  }
  return [...newest.values()];
}

/**
 * The last 24 hourly values for a sensor, oldest first, ending with the hour of the latest reading.
 * Hours without data are null, so CPCB's minimum-hours rules can be applied.
 */
async function lastDay(client: Client, { sensorId, reading }: CurrentSensor): Promise<(number | null)[]> {
  const lastHourStart = Date.parse(reading.measuredAt) - HOUR_MS;
  const firstHourStart = lastHourStart - (HOURS_IN_DAY - 1) * HOUR_MS;
  const from = new Date(firstHourStart).toISOString();
  const hours = await getResults(
    client,
    `/sensors/${sensorId}/hours?datetime_from=${from}&datetime_to=${reading.measuredAt}&limit=48`,
    HourSchema,
  );
  const series: (number | null)[] = Array.from({ length: HOURS_IN_DAY }, () => null);
  for (const { value, period } of hours) {
    const slot = Math.round((Date.parse(period.datetimeFrom.utc) - firstHourStart) / HOUR_MS);
    if (value !== null && value >= 0 && slot >= 0 && slot < HOURS_IN_DAY) {
      series[slot] = toCpcbUnits(reading.pollutant, value);
    }
  }
  return series;
}

type Detail = NonNullable<StationReport["nearest"]>;

/** A station's current readings and, in India, its National AQI from the last 24 hours. */
async function stationDetail(
  client: Client,
  location: Location,
  station: Station,
  nowMs: number,
): Promise<Detail> {
  const sensors = await currentSensors(client, location, nowMs);
  const readings = sensors.map((s) => s.reading);
  if (station.countryCode !== "IN" || sensors.length === 0) return { station, readings, naqi: null };
  // Skip the hourly downloads when the station cannot qualify whatever its history holds.
  const reason = missingRequirement(readings.map((r) => r.pollutant));
  if (reason) return { station, readings, naqi: { ok: false, reason, subIndices: [] } };
  const series = await Promise.all(sensors.map((s) => lastDay(client, s)));
  const hourly = Object.fromEntries(sensors.map((s, i) => [s.reading.pollutant, series[i] ?? []]));
  return { station, readings, naqi: computeNaqi(hourly) };
}

/**
 * The nearest station's detail, unless it cannot give a National AQI and the next nearest can: then the
 * next one, so the index comes from the closest station that has the data for it.
 */
async function bestDetail(
  client: Client,
  active: readonly { location: Location; station: Station }[],
  nowMs: number,
): Promise<Detail | null> {
  let fallback: Detail | null = null;
  for (const { location, station } of active.slice(0, NAQI_CANDIDATES)) {
    const detail = await stationDetail(client, location, station, nowMs);
    if (!detail.naqi || detail.naqi.ok) return detail;
    fallback ??= detail;
  }
  return fallback;
}

/** Options for {@link fetchStationReport}; `fetchImpl` and `nowMs` are injected in tests. */
export interface StationReportOptions {
  key: string;
  nowMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Active monitoring stations near a point (already rounded to ~1 km), the nearest one's current
 * readings, and its CPCB National AQI when it is in India and has enough data.
 */
export async function fetchStationReport(
  lat: number,
  lon: number,
  { key, nowMs = Date.now(), fetchImpl = fetch }: StationReportOptions,
): Promise<StationReport> {
  const client: Client = { key, fetchImpl };
  const active = await activeStations(client, lat, lon, nowMs);
  return {
    source: "OpenAQ",
    fetchedAt: new Date(nowMs).toISOString(),
    stations: active.slice(0, MAX_STATIONS).map((entry) => entry.station),
    nearest: await bestDetail(client, active, nowMs),
  };
}
