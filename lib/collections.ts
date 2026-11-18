/**
 * Builds a record with one entry per key. TypeScript types Object.fromEntries as
 * Record<string, V>, so this is the single, documented place where the keys are
 * narrowed back to K: every key in `keys` is present, by construction.
 */
export function recordFromKeys<K extends string, V>(
  keys: readonly K[],
  valueFor: (key: K) => V,
): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, valueFor(key)])) as Record<K, V>;
}
