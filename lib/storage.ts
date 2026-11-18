import type { z } from "zod";

/**
 * Versioned, validated localStorage access, exposed as a subscribable store.
 * Only non-sensitive preferences are stored. Every read is validated, so tampered or
 * outdated data falls back to defaults. Writes notify subscribers in this tab, and the
 * browser's "storage" event keeps other tabs in sync.
 */
const PREFIX = "breathewise:v1:";

export const STORAGE_KEYS = {
  settings: "settings",
  preferences: "preferences",
  place: "place",
  recentPlaces: "recent-places",
  lastSnapshot: "last-snapshot",
  indoorChecklist: "indoor-checklist",
  mission: "mission",
} as const;
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // blocked storage (privacy mode, sandboxed frames)
  }
}

function readRaw(key: StorageKey): string | null {
  try {
    return storage()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribes to changes from this tab and from other tabs. Returns an unsubscribe function. */
export function subscribeToStorage(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reads and validates a stored value; returns the fallback when missing, unreadable or invalid. */
export function readStored<T>(key: StorageKey, schema: z.ZodType<T>, fallback: T): T {
  return parse(readRaw(key), schema, fallback);
}

/**
 * Returns a reader for one key that yields the same object until the stored text changes.
 * React's useSyncExternalStore requires this referential stability.
 */
export function storedSnapshotReader<T>(key: StorageKey, schema: z.ZodType<T>, fallback: T): () => T {
  let cache: { raw: string | null; value: T } | null = null;
  return () => {
    const raw = readRaw(key);
    if (cache?.raw !== raw) cache = { raw, value: parse(raw, schema, fallback) };
    return cache.value;
  };
}

export function writeStored(key: StorageKey, value: unknown): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(PREFIX + key, JSON.stringify(value));
    notify();
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

/** Removes every BreatheWise key (Settings → "Clear all local data"). */
export function clearAllStored(): void {
  const s = storage();
  if (!s) return;
  try {
    const keys = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(
      (key): key is string => key?.startsWith(PREFIX) === true,
    );
    keys.forEach((key) => s.removeItem(key));
  } catch {
    /* storage blocked: nothing to clear */
  }
  notify();
}
