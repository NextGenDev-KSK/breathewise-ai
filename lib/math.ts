/** Small numeric helpers shared by the engine. Missing readings (null) are never treated as zero. */

/** Arithmetic mean, or null for an empty list. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Rounds to a fixed number of decimal places. */
export function roundTo(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Keeps only present values from a series that may contain missing (null) readings. */
export function presentValues(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

function extremeBy<T>(
  items: readonly T[],
  score: (item: T) => number | null,
  isBetter: (candidate: number, current: number) => boolean,
): T | null {
  let best: { item: T; value: number } | null = null;
  for (const item of items) {
    const value = score(item);
    if (value !== null && (best === null || isBetter(value, best.value))) best = { item, value };
  }
  return best?.item ?? null;
}

/** The item with the lowest score (ties keep the earliest); items scoring null are skipped. */
export function minBy<T>(items: readonly T[], score: (item: T) => number | null): T | null {
  return extremeBy(items, score, (candidate, current) => candidate < current);
}

/** The item with the highest score (ties keep the earliest); items scoring null are skipped. */
export function maxBy<T>(items: readonly T[], score: (item: T) => number | null): T | null {
  return extremeBy(items, score, (candidate, current) => candidate > current);
}
