import { CONCERN_LABELS } from "@/lib/air/indices";
import type { SeriesPoint } from "@/lib/air/series";
import { formatDay, type FormatTime } from "@/lib/time";

interface TableProps {
  id: string;
  hidden: boolean;
  title: string;
  label: string;
  unit: string;
  points: SeriesPoint[];
  formatTime: FormatTime;
}

/** The chart's data as an accessible table (the full alternative to the visual chart). */
export function ChartDataTable({ id, hidden, title, label, unit, points, formatTime }: TableProps) {
  return (
    <div id={id} hidden={hidden} className="border-line mt-2 max-h-80 overflow-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="bg-canvas text-ink-3 sticky top-0 text-xs tracking-wide uppercase">
          <tr>
            <th scope="col" className="px-3 py-2">
              Time
            </th>
            <th scope="col" className="px-3 py-2">
              {label}
            </th>
            <th scope="col" className="px-3 py-2">
              Concern
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.time} className="border-line border-t">
              <th scope="row" className="text-ink px-3 py-1.5 font-medium">
                {formatDay(point.time)} {formatTime(point.time)}
              </th>
              <td className="tabular px-3 py-1.5">
                {point.value === null ? "Not available" : `${Math.round(point.value)} ${unit}`}
              </td>
              <td className="px-3 py-1.5">
                {point.level === null ? "Unknown" : CONCERN_LABELS[point.level]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
