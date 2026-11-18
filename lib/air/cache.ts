import type { AirQualitySnapshot, Place } from "@/types/air";
import { fetchAirQuality } from "@/lib/air/openMeteo";
import { SnapshotSchema } from "@/lib/air/snapshotSchema";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";

/** In-memory response cache. Open-Meteo current data refreshes ~hourly, so 10 minutes is plenty. */
export const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_PLACES = 20;

const cache = new Map<string, AirQualitySnapshot>();

export function cacheKey(place: Pick<Place, "latitude" | "longitude">): string {
  return `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
}

export function getCached(place: Place, nowMs: number): AirQualitySnapshot | null {
  const hit = cache.get(cacheKey(place));
  if (!hit || nowMs - hit.fetchedAt > CACHE_TTL_MS) return null;
  return { ...hit, place };
}

export function setCached(snapshot: AirQualitySnapshot): void {
  cache.set(cacheKey(snapshot.place), snapshot);
  if (cache.size > MAX_CACHED_PLACES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Forgets one place, so the next load fetches fresh data (used by "Refresh"). */
export function invalidateCached(place: Place): void {
  cache.delete(cacheKey(place));
}

export function clearCache(): void {
  cache.clear();
}

/**
 * Returns cached data when fresh, otherwise fetches, caches, and keeps a copy in localStorage
 * as an offline fallback.
 */
export async function loadAirQuality(place: Place, signal: AbortSignal): Promise<AirQualitySnapshot> {
  const cached = getCached(place, Date.now());
  if (cached) return cached;
  const snapshot = await fetchAirQuality(place, { signal });
  setCached(snapshot);
  writeStored(STORAGE_KEYS.lastSnapshot, snapshot);
  return snapshot;
}

/** The last successfully loaded snapshot for this place, labelled as a saved copy, if any. */
export function savedSnapshotFor(place: Place): AirQualitySnapshot | null {
  const saved = readStored(STORAGE_KEYS.lastSnapshot, SnapshotSchema.nullable(), null);
  return saved?.place.id === place.id ? { ...saved, origin: "cache" } : null;
}
