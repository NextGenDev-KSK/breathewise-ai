import { z } from "zod";
import type { Place } from "@/types/air";

export const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;

const ResultSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().max(100).optional(),
  country_code: z.string().max(3).optional(),
  admin1: z.string().max(200).optional(),
});
const ResponseSchema = z.object({ results: z.array(z.unknown()).optional() });

export class GeocodingError extends Error {
  constructor(message: string, readonly kind: "network" | "http" | "invalid-response" | "aborted") {
    super(message);
    this.name = "GeocodingError";
  }
}

/** Trims and bounds a search query; returns null if it is too short to search. */
export function sanitizeQuery(query: string): string | null {
  // Strip control characters, collapse whitespace.
  const cleaned = query.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  return cleaned.length >= MIN_QUERY_LENGTH ? cleaned : null;
}

export function buildGeocodingUrl(query: string, count = 8): string {
  const params = new URLSearchParams({ name: query, count: String(count), language: "en", format: "json" });
  return `${GEOCODING_ENDPOINT}?${params.toString()}`;
}

/** Parses geocoder results, silently dropping malformed entries. */
export function parseGeocodingResults(raw: unknown): Place[] {
  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) throw new GeocodingError("Location search returned an unexpected format.", "invalid-response");
  const places: Place[] = [];
  for (const item of parsed.data.results ?? []) {
    const r = ResultSchema.safeParse(item);
    if (!r.success) continue;
    places.push({
      id: `geo-${r.data.id}`,
      name: r.data.name,
      admin1: r.data.admin1,
      country: r.data.country ?? "Unknown country",
      countryCode: (r.data.country_code ?? "").toUpperCase(),
      latitude: r.data.latitude,
      longitude: r.data.longitude,
      source: "search",
    });
  }
  return places;
}

export async function searchPlaces(
  query: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Place[]> {
  const q = sanitizeQuery(query);
  if (!q) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(buildGeocodingUrl(q), { signal: opts.signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new GeocodingError("Search cancelled.", "aborted");
    throw new GeocodingError("Could not reach the location search service.", "network");
  }
  if (!res.ok) throw new GeocodingError(`Location search failed (status ${res.status}).`, "http");
  return parseGeocodingResults(await res.json().catch(() => null));
}

/** A place built from browser geolocation. Coordinates are rounded to ~1 km for privacy. */
export function placeFromCoordinates(latitude: number, longitude: number): Place {
  const lat = Math.round(latitude * 100) / 100;
  const lon = Math.round(longitude * 100) / 100;
  return {
    id: `gps-${lat}-${lon}`,
    name: "Your location",
    country: "Detected by your browser",
    countryCode: "",
    latitude: lat,
    longitude: lon,
    source: "geolocation",
  };
}

export function placeLabel(place: Place): string {
  const parts = [place.name, place.admin1, place.source === "geolocation" ? undefined : place.country].filter(Boolean);
  return parts.join(", ");
}
