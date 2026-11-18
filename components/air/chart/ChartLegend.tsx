import { CONCERN_LABELS, CONCERN_LEVELS } from "@/lib/air/indices";
import { MARK_COLORS } from "@/components/air/chart/geometry";

/** Colour key; each colour is also named in text, so colour is never the only cue. */
export function ChartLegend() {
  return (
    <ul className="text-ink-3 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Colour legend">
      {CONCERN_LEVELS.map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-sm"
            style={{ background: MARK_COLORS[level] }}
          />
          {CONCERN_LABELS[level]}
        </li>
      ))}
    </ul>
  );
}
