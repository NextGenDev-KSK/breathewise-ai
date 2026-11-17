import type { AirQualitySnapshot, Place } from "@/types/air";

/** In-memory response cache. Open-Meteo current data refreshes ~hourly, so 10 minutes is plenty. */
export const CACHE_TTL_MS = 10 * 60 * 1000;

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
  if (cache.size > 20) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
}

export function clearCache(): void {
  cache.clear();
}
