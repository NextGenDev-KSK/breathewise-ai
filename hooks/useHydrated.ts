"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => undefined;

/** False during the server render and hydration, true afterwards (no effect, no extra render pass). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
