import type { z } from "zod";

/**
 * Versioned, validated localStorage access. Only non-sensitive preferences are stored.
 * Every read is validated, so tampered or outdated data falls back to defaults.
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

export function readStored<T>(key: StorageKey, schema: z.ZodType<T>, fallback: T): T {
  const s = storage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: StorageKey, value: unknown): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

export function removeStored(key: StorageKey): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Removes every BreatheWise key (Settings → "Clear all local data"). */
export function clearAllStored(): void {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* ignore */
  }
}
