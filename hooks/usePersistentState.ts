"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { readStored, writeStored, type StorageKey } from "@/lib/storage";

/**
 * State mirrored to localStorage. Starts from the fallback on the server and first client
 * render (avoiding hydration mismatches), then loads the stored value after mount.
 */
export function usePersistentState<T>(key: StorageKey, schema: z.ZodType<T>, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Reading browser storage is an external-system sync, which must happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(readStored(key, schema, fallback));
    setLoaded(true);
    // fallback/schema are stable module constants at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeStored(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded] as const;
}
