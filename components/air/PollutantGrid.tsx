import type { AirQualitySnapshot, PollutantKey, UsSubIndexPollutant } from "@/types/air";
import { US_SUBINDEX_POLLUTANTS } from "@/types/air";
import { POLLUTANTS, PRIMARY_POLLUTANTS, formatConcentration, guidelineRatio } from "@/lib/air/pollutants";
import { usAqiBand } from "@/lib/air/indices";
import { LevelBadge } from "@/components/ui/LevelBadge";

function hasSubIndex(key: PollutantKey): key is UsSubIndexPollutant {
  return (US_SUBINDEX_POLLUTANTS as readonly string[]).includes(key);
}

export function PollutantGrid({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const extras = (["dust", "ammonia"] as const).filter((k) => snapshot.current.pollutants[k] !== null);
  const keys: PollutantKey[] = [...PRIMARY_POLLUTANTS, ...extras];
  return (
    <section aria-labelledby="pollutants-heading">
      <h2 id="pollutants-heading" className="mb-3 text-lg font-semibold">
        Pollutants now
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => {
          const info = POLLUTANTS[key];
          const value = snapshot.current.pollutants[key];
          const sub = hasSubIndex(key) ? snapshot.current.usSubIndices[key] : null;
          const band = usAqiBand(sub);
          const ratio = guidelineRatio(value, key);
          return (
            <li
              key={key}
              className="border-line bg-surface rounded-xl border p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-ink text-sm font-semibold">{info.label}</h3>
                {band && sub !== null ? (
                  <LevelBadge level={band.level} label={`US sub-index ${Math.round(sub)}`} />
                ) : null}
              </div>
              <p className="tabular text-ink mt-2 text-2xl font-bold">
                {value === null ? (
                  <span className="text-ink-3 text-base font-medium">Not available</span>
                ) : (
                  formatConcentration(value, key)
                )}
              </p>
              <p className="text-ink-3 mt-1 text-xs">{info.description}</p>
              {ratio !== null && info.whoGuideline ? (
                <p className="text-ink-2 mt-2 text-xs">
                  {ratio >= 1 ? `${ratio.toFixed(1)}×` : "Below"} the WHO {info.whoGuideline.averaging}{" "}
                  guideline ({info.whoGuideline.value} {info.unit}){" "}
                  <span className="text-ink-3">· context only: hourly model value</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
