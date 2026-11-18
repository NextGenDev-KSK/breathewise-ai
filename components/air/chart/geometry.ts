import type { ConcernLevel } from "@/lib/air/indices";
import type { SeriesPoint } from "@/lib/air/series";
import { presentValues } from "@/lib/math";

/** Bar fill for each concern level; every colour has at least 3:1 contrast on white. */
export const MARK_COLORS: Record<ConcernLevel | "na", string> = {
  0: "var(--color-lvl0)",
  1: "var(--color-lvl1)",
  2: "var(--color-lvl2)",
  3: "var(--color-lvl3)",
  4: "var(--color-lvl4)",
  5: "var(--color-lvl5)",
  na: "var(--color-lvlna)",
};

/** Rounds up to a "nice" axis maximum (1, 2 or 5 × a power of ten). */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * power;
}

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { left: 40, right: 8, top: 12, bottom: 28 };
/** Fraction of each hour's slot that the bar fills. */
const BAR_FILL = 0.72;

export interface ChartGeometry {
  width: number;
  height: number;
  pad: typeof PAD;
  plotWidth: number;
  plotHeight: number;
  yMax: number;
  /** Horizontal space per hour. */
  slot: number;
  barWidth: number;
  ticks: number[];
  /** Show an x-axis label every n hours. */
  labelEvery: number;
}

/** Scales and spacing for a bar chart of hourly values (headroom of 5% above the highest bar). */
export function chartGeometry(points: readonly SeriesPoint[]): ChartGeometry {
  const yMax = niceMax(Math.max(...presentValues(points.map((p) => p.value)), 1) * 1.05);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const slot = points.length ? plotWidth / points.length : plotWidth;
  return {
    width: WIDTH,
    height: HEIGHT,
    pad: PAD,
    plotWidth,
    plotHeight: HEIGHT - PAD.top - PAD.bottom,
    yMax,
    slot,
    barWidth: Math.max(2, slot * BAR_FILL),
    ticks: [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(yMax * fraction)),
    labelEvery: points.length > 30 ? 6 : 3,
  };
}
