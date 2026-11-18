"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { z } from "zod";
import { storedSnapshotReader, subscribeToStorage, writeStored, type StorageKey } from "@/lib/storage";

type Updater<T> = T | ((previous: T) => T);

/**
 * A validated value persisted in localStorage, read through useSyncExternalStore.
 * The server render and hydration use `fallback`; the stored value follows immediately
 * after, without an extra effect. Changes in other tabs are picked up automatically.
 */
export function useStoredState<T>(key: StorageKey, schema: z.ZodType<T>, fallback: T) {
  const getSnapshot = useMemo(() => storedSnapshotReader(key, schema, fallback), [key, schema, fallback]);
  const value = useSyncExternalStore(subscribeToStorage, getSnapshot, () => fallback);

  const update = useCallback(
    (next: Updater<T>) => {
      const resolved = next instanceof Function ? next(getSnapshot()) : next;
      writeStored(key, resolved);
    },
    [key, getSnapshot],
  );

  return [value, update] as const;
}
