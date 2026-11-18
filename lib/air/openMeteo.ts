import { z } from "zod";
import { recordFromKeys } from "@/lib/collections";
import {
  POLLUTANT_KEYS,
  US_SUBINDEX_POLLUTANTS,
  type AirQualitySnapshot,
  type HourlyPoint,
  type Place,
} from "@/types/air";
import { AIR_MODELS, selectModelForLocation } from "@/lib/air/models";
import { isLocalTimeString, localTimeToEpoch } from "@/lib/time";

const AIR_QUALITY_ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** Only the variables the app actually uses are requested. */
const CURRENT_VARIABLES = [
  ...POLLUTANT_KEYS,
  "us_aqi",
  "european_aqi",
  ...US_SUBINDEX_POLLUTANTS.map((p) => `us_aqi_${p}`),
] as const;
const HOURLY_VARIABLES = ["pm2_5", "pm10", "nitrogen_dioxide", "ozone", "us_aqi", "european_aqi"] as const;
const FORECAST_DAYS = 4;

const num = z.number().finite().nullable().optional();

const RawAirQualitySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z
    .number()
    .int()
    .min(-14 * 3600)
    .max(14 * 3600),
  timezone: z.string().min(1).max(64),
  timezone_abbreviation: z.string().max(16).optional().default(""),
  current: z
    .record(z.string(), z.union([z.string(), z.number(), z.null()]))
    .and(z.object({ time: z.string() })),
  hourly: z.object({ time: z.array(z.string()) }).catchall(z.array(num.transform((v) => v ?? null))),
});

export class AirQualityError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "rate-limited" | "http" | "invalid-response" | "aborted",
  ) {
    super(message);
    this.name = "AirQualityError";
  }
}

/**
 * Open-Meteo air-quality URL for a location. The CAMS domain is chosen by region (European model
 * inside Europe, global model elsewhere) and stated explicitly so the source is always known.
 */
export function buildAirQualityUrl(
  place: Pick<Place, "latitude" | "longitude">,
  domain = selectModelForLocation(place.latitude, place.longitude),
): string {
  const params = new URLSearchParams({
    latitude: place.latitude.toFixed(4),
    longitude: place.longitude.toFixed(4),
    current: CURRENT_VARIABLES.join(","),
    hourly: HOURLY_VARIABLES.join(","),
    forecast_days: String(FORECAST_DAYS),
    timezone: "auto",
    domains: domain,
  });
  return `${AIR_QUALITY_ENDPOINT}?${params.toString()}`;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Validates and normalizes a raw Open-Meteo response. Missing values stay `null`.
 * Throws AirQualityError("invalid-response") for structurally invalid payloads.
 */
export function normalizeAirQuality(
  raw: unknown,
  place: Place,
  domain: "cams_global" | "cams_europe",
  fetchedAt: number,
): AirQualitySnapshot {
  const parsed = RawAirQualitySchema.safeParse(raw);
  if (!parsed.success)
    throw new AirQualityError("The air-quality service returned an unexpected format.", "invalid-response");
  const data = parsed.data;
  const offset = data.utc_offset_seconds;

  if (!isLocalTimeString(data.current.time)) {
    throw new AirQualityError("The air-quality service returned an invalid timestamp.", "invalid-response");
  }

  const pollutants = recordFromKeys(POLLUTANT_KEYS, (k) => readNumber(data.current[k]));
  const usSubIndices = recordFromKeys(US_SUBINDEX_POLLUTANTS, (k) => readNumber(data.current[`us_aqi_${k}`]));

  const series = (name: string): (number | null)[] => data.hourly[name] ?? [];
  const hourly: HourlyPoint[] = [];
  data.hourly.time.forEach((time, i) => {
    if (!isLocalTimeString(time)) return;
    const at = (name: string) => readNumber(series(name)[i]);
    hourly.push({
      time,
      epochMs: localTimeToEpoch(time, offset),
      pm2_5: at("pm2_5"),
      pm10: at("pm10"),
      nitrogen_dioxide: at("nitrogen_dioxide"),
      ozone: at("ozone"),
      us_aqi: at("us_aqi"),
      european_aqi: at("european_aqi"),
    });
  });

  return {
    place,
    timezone: data.timezone,
    timezoneAbbreviation: data.timezone_abbreviation,
    utcOffsetSeconds: offset,
    current: {
      time: data.current.time,
      epochMs: localTimeToEpoch(data.current.time, offset),
      pollutants,
      usAqi: readNumber(data.current.us_aqi),
      europeanAqi: readNumber(data.current.european_aqi),
      usSubIndices,
    },
    hourly,
    model: AIR_MODELS[domain],
    fetchedAt,
    origin: "live",
  };
}

/** True when the response carries no usable pollutant data at all. */
export function isEmptySnapshot(s: AirQualitySnapshot): boolean {
  const anyCurrent = Object.values(s.current.pollutants).some((v) => v !== null) || s.current.usAqi !== null;
  const anyHourly = s.hourly.some((h) => h.pm2_5 !== null || h.us_aqi !== null);
  return !anyCurrent && !anyHourly;
}

interface FetchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

async function requestDomain(
  place: Place,
  domain: "cams_global" | "cams_europe",
  opts: FetchOptions,
): Promise<AirQualitySnapshot> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(buildAirQualityUrl(place, domain), {
      signal: opts.signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      throw new AirQualityError("Request cancelled.", "aborted");
    throw new AirQualityError("Could not reach the air-quality service. Check your connection.", "network");
  }
  if (res.status === 429)
    throw new AirQualityError(
      "The air-quality service is rate-limiting requests. Try again shortly.",
      "rate-limited",
    );
  if (!res.ok)
    throw new AirQualityError(`The air-quality service responded with status ${res.status}.`, "http");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new AirQualityError("The air-quality service returned unreadable data.", "invalid-response");
  }
  return normalizeAirQuality(body, place, domain, (opts.now ?? Date.now)());
}

/**
 * Fetches air quality for a place. Inside the European domain the higher-resolution
 * European model is tried first; if it has no data for the point, the global model is used.
 */
export async function fetchAirQuality(place: Place, opts: FetchOptions = {}): Promise<AirQualitySnapshot> {
  const domain = selectModelForLocation(place.latitude, place.longitude);
  const snapshot = await requestDomain(place, domain, opts);
  if (domain === "cams_europe" && isEmptySnapshot(snapshot)) {
    return requestDomain(place, "cams_global", opts);
  }
  return snapshot;
}
