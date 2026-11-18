import { CONCERN_LABELS } from "@/lib/air/indices";
import type { SeriesPoint } from "@/lib/air/series";
import { formatDay, type FormatTime } from "@/lib/time";
import { MARK_COLORS, type ChartGeometry } from "@/components/air/chart/geometry";

interface PlotProps {
  points: SeriesPoint[];
  geometry: ChartGeometry;
  unit: string;
  formatTime: FormatTime;
  /** Id of the element whose text describes the chart (its accessible name). */
  summaryId: string;
}

function GridLines({ geometry: g }: { geometry: ChartGeometry }) {
  return (
    <>
      {g.ticks.map((tick) => {
        const y = g.pad.top + g.plotHeight - (tick / g.yMax) * g.plotHeight;
        return (
          <g key={tick}>
            <line
              x1={g.pad.left}
              x2={g.width - g.pad.right}
              y1={y}
              y2={y}
              stroke="var(--color-line)"
              strokeDasharray={tick === 0 ? undefined : "3 4"}
            />
            <text x={g.pad.left - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {tick}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Bar({
  point,
  index,
  geometry: g,
  unit,
  formatTime,
}: {
  point: SeriesPoint;
  index: number;
  geometry: ChartGeometry;
  unit: string;
  formatTime: FormatTime;
}) {
  const x = g.pad.left + index * g.slot + (g.slot - g.barWidth) / 2;
  const baseline = g.pad.top + g.plotHeight;
  if (point.value === null) {
    return (
      <g>
        <title>{`${formatTime(point.time)}: no data`}</title>
        <rect
          x={x}
          y={baseline - 4}
          width={g.barWidth}
          height={4}
          fill="none"
          stroke="var(--color-lvlna)"
          strokeDasharray="2 2"
        />
      </g>
    );
  }
  const height = Math.max(1, (point.value / g.yMax) * g.plotHeight);
  const concern = point.level !== null ? `, ${CONCERN_LABELS[point.level].toLowerCase()} concern` : "";
  return (
    <g>
      <title>{`${formatDay(point.time)} ${formatTime(point.time)}: ${Math.round(point.value)} ${unit}${concern}`}</title>
      <rect
        x={x}
        y={baseline - height}
        width={g.barWidth}
        height={height}
        rx={Math.min(3, g.barWidth / 3)}
        fill={MARK_COLORS[point.level ?? "na"]}
      />
    </g>
  );
}

/** The SVG bar chart; its accessible name is the plain-language summary. */
export function ChartPlot({ points, geometry: g, unit, formatTime, summaryId }: PlotProps) {
  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      className="h-auto w-full min-w-[600px]"
      role="img"
      aria-labelledby={summaryId}
    >
      <GridLines geometry={g} />
      {points.map((point, index) => (
        <Bar key={point.time} point={point} index={index} geometry={g} unit={unit} formatTime={formatTime} />
      ))}
      {points.map((point, index) =>
        index % g.labelEvery === 0 ? (
          <text
            key={`label-${point.time}`}
            x={g.pad.left + index * g.slot + g.slot / 2}
            y={g.height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-ink-3)"
          >
            {formatTime(point.time)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
