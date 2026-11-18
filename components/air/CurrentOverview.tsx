"use client";

import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { Card } from "@/components/ui/Card";
import { LevelBadge, LEVEL_CLASSES } from "@/components/ui/LevelBadge";
import { cn } from "@/components/ui/cn";
import { STANDARD_NAMES, euAqiBand, usAqiBand, type IndexStandard } from "@/lib/air/indices";
import { POLLUTANTS } from "@/lib/air/pollutants";
import { currentConcern, dominantPollutant } from "@/lib/engine/analysis";
import { placeLabel } from "@/lib/air/geocoding";
import { formatDay } from "@/lib/time";

const INTERPRETATION: Record<number, { meaning: string; priority: string }> = {
  0: {
    meaning: "Air pollution is low in the model for this area.",
    priority: "A good day for outdoor activity and airing out your home.",
  },
  1: {
    meaning:
      "Air quality is acceptable for most people, though unusually sensitive people may notice effects.",
    priority: "Normal activities are reasonable; sensitive people can favour cleaner hours.",
  },
  2: {
    meaning:
      "Sensitive groups (children, older adults, people with heart or lung conditions) may be affected.",
    priority: "Time outdoor exercise for cleaner hours and keep windows closed during peaks.",
  },
  3: {
    meaning: "Everyone may begin to be affected; sensitive groups more seriously.",
    priority: "Reduce prolonged or strenuous outdoor activity and protect indoor air.",
  },
  4: {
    meaning: "Health effects are more likely for everyone.",
    priority: "Avoid strenuous outdoor activity; keep indoor air as clean as possible.",
  },
  5: {
    meaning: "This is an emergency-level reading on this index.",
    priority: "Stay indoors where possible with filtered air; follow local health advisories.",
  },
};

function IndexBlock({
  standard,
  value,
  primary,
}: {
  standard: IndexStandard;
  value: number | null;
  primary: boolean;
}) {
  const band = standard === "us" ? usAqiBand(value) : euAqiBand(value);
  return (
    <div className={cn("rounded-xl border p-4", primary ? "border-line bg-canvas" : "border-line")}>
      <p className="text-ink-3 text-xs font-semibold tracking-wide uppercase">{STANDARD_NAMES[standard]}</p>
      {value === null || !band ? (
        <p className="text-ink-3 mt-2 text-sm">Not available for this location.</p>
      ) : (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={cn(
              "tabular text-ink font-[family-name:var(--font-display)] font-bold",
              primary ? "text-5xl" : "text-3xl",
            )}
          >
            {Math.round(value)}
          </span>
          <LevelBadge level={band.level} label={band.label} />
        </div>
      )}
    </div>
  );
}

/**
 * Headline card: the current concern level, the main pollutant, and both index scales (the user's
 * preferred one first), each clearly labelled with its standard.
 */
export function CurrentOverview({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { settings, formatTime } = useApp();
  const concern = currentConcern(snapshot);
  const dominant = dominantPollutant(snapshot);
  const primary = settings.aqiStandard;
  const secondary: IndexStandard = primary === "us" ? "eu" : "us";
  const valueFor = (s: IndexStandard) => (s === "us" ? snapshot.current.usAqi : snapshot.current.europeanAqi);
  const interp = concern ? INTERPRETATION[concern.level] : null;
  const accent = LEVEL_CLASSES[concern?.level ?? "na"];

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1.5", accent.mark)} aria-hidden="true" />
      <div className="grid gap-6 p-5 md:grid-cols-[1.1fr_1fr] md:p-6">
        <div>
          <p className="text-ink-3 text-sm">
            {snapshot.origin === "demo" ? "Sample location" : placeLabel(snapshot.place)} ·{" "}
            {formatDay(snapshot.current.time)}, {formatTime(snapshot.current.time)}{" "}
            {snapshot.timezoneAbbreviation ? `(${snapshot.timezoneAbbreviation})` : ""}
          </p>
          <h2 className="text-ink mt-2 text-xl font-bold sm:text-2xl">
            {concern ? (
              <>
                Outdoor air concern:{" "}
                <span className={cn("rounded-md px-1.5", accent.bg, accent.fg)}>{concern.label}</span>
              </>
            ) : (
              "Current index not available"
            )}
          </h2>
          {interp ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-ink font-semibold">What this indicates</dt>
                <dd className="text-ink-2">{interp.meaning}</dd>
              </div>
              <div>
                <dt className="text-ink font-semibold">Most concerning pollutant</dt>
                <dd className="text-ink-2">
                  {dominant ? (
                    <>
                      {POLLUTANTS[dominant.key].label}, with US AQI sub-index {Math.round(dominant.subIndex)}.{" "}
                      {POLLUTANTS[dominant.key].description}
                    </>
                  ) : (
                    "Sub-index data is not available."
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-ink font-semibold">Prioritise today</dt>
                <dd className="text-ink-2">{interp.priority}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-ink-2 mt-3 text-sm">
              No index or PM2.5 value is available for the current hour. Pollutant values below show what is
              available.
            </p>
          )}
          {concern ? (
            <p className="text-ink-3 mt-4 text-xs">
              Concern level derived from the {concern.basis} ({concern.standardLabel}).
            </p>
          ) : null}
        </div>
        <div className="grid content-start gap-3">
          <IndexBlock standard={primary} value={valueFor(primary)} primary />
          <IndexBlock standard={secondary} value={valueFor(secondary)} primary={false} />
          <p className="text-ink-3 text-xs">
            Index values are calculated by Open-Meteo from model data. Change the primary standard in
            Settings.
          </p>
        </div>
      </div>
    </Card>
  );
}
