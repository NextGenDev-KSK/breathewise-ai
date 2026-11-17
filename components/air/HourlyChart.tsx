"use client";

import { useId, useState } from "react";
import { Table2 } from "lucide-react";
import type { ConcernLevel } from "@/lib/air/indices";
import { CONCERN_LABELS } from "@/lib/air/indices";
import { formatDay } from "@/lib/time";

export interface ChartPoint {
  time: string;
  value: number | null;
  level: ConcernLevel | null;
}

const MARK_COLORS: Record<ConcernLevel | "na", string> = {
  0: "var(--color-lvl0)",
  1: "var(--color-lvl1)",
  2: "var(--color-lvl2)",
  3: "var(--color-lvl3)",
  4: "var(--color-lvl4)",
  5: "var(--color-lvl5)",
  na: "var(--color-lvlna)",
};

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Builds the plain-language summary that serves as the chart's text alternative. */
export function summarizeSeries(points: ChartPoint[], label: string, fmt: (t: string) => string): string {
  const valid = points.filter((p): p is ChartPoint & { value: number } => p.value !== null);
  if (valid.length === 0) return `No ${label} forecast values are available for this period.`;
  const min = valid.reduce((a, b) => (b.value < a.value ? b : a));
  const max = valid.reduce((a, b) => (b.value > a.value ? b : a));
  const missing = points.length - valid.length;
  return `${label} ranges from ${Math.round(min.value)} (lowest at ${fmt(min.time)}) to ${Math.round(max.value)} (highest at ${fmt(max.time)}) across ${points.length} hours.${missing ? ` ${missing} hours have no data.` : ""}`;
}

export function HourlyChart({
  points,
  label,
  unit,
  formatTime,
  title,
}: {
  points: ChartPoint[];
  label: string;
  unit: string;
  formatTime: (t: string) => string;
  title: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const tableId = useId();
  const W = 720;
  const H = 220;
  const pad = { l: 40, r: 8, t: 12, b: 28 };
  const valid = points.map((p) => p.value).filter((v): v is number => v !== null);
  const yMax = niceMax(Math.max(...valid, 1) * 1.05);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = points.length ? innerW / points.length : innerW;
  const barW = Math.max(2, slot * 0.72);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const labelEvery = points.length > 30 ? 6 : 3;
  const summary = summarizeSeries(points, label, formatTime);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      {/* Keeps axis labels legible on phones; the chart scrolls inside its card, never the page. */}
      <div className="overflow-x-auto rounded-md" tabIndex={0} role="region" aria-label={`${title} (scrollable)`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[600px]" role="img" aria-labelledby={summaryId}>
        {ticks.map((t) => {
          const y = pad.t + innerH - (t / yMax) * innerH;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
                {t}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2;
          if (p.value === null) {
            return (
              <g key={p.time}>
                <title>{`${formatTime(p.time)}: no data`}</title>
                <rect x={x} y={pad.t + innerH - 4} width={barW} height={4} fill="none" stroke="var(--color-lvlna)" strokeDasharray="2 2" />
              </g>
            );
          }
          const h = Math.max(1, (p.value / yMax) * innerH);
          return (
            <g key={p.time}>
              <title>{`${formatDay(p.time)} ${formatTime(p.time)}: ${Math.round(p.value)} ${unit}${p.level !== null ? `, ${CONCERN_LABELS[p.level].toLowerCase()} concern` : ""}`}</title>
              <rect x={x} y={pad.t + innerH - h} width={barW} height={h} rx={Math.min(3, barW / 3)} fill={MARK_COLORS[p.level ?? "na"]} />
            </g>
          );
        })}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={`l-${p.time}`} x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
              {formatTime(p.time)}
            </text>
          ) : null,
        )}
      </svg>
      </div>
      <p id={summaryId} className="mt-2 text-sm text-ink-2">
        {summary}
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3" aria-label="Colour legend">
        {([0, 1, 2, 3, 4, 5] as ConcernLevel[]).map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ background: MARK_COLORS[l] }} />
            {CONCERN_LABELS[l]}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        aria-expanded={showTable}
        aria-controls={tableId}
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-semibold text-info-800 hover:underline"
      >
        <Table2 aria-hidden="true" className="size-4" />
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      <div id={tableId} hidden={!showTable} className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="sticky top-0 bg-canvas text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2">Time</th>
              <th scope="col" className="px-3 py-2">{label}</th>
              <th scope="col" className="px-3 py-2">Concern</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.time} className="border-t border-line">
                <th scope="row" className="px-3 py-1.5 font-medium text-ink">
                  {formatDay(p.time)} {formatTime(p.time)}
                </th>
                <td className="tabular px-3 py-1.5">{p.value === null ? "Not available" : `${Math.round(p.value)} ${unit}`}</td>
                <td className="px-3 py-1.5">{p.level === null ? "Unknown" : CONCERN_LABELS[p.level]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
