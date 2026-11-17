import { Clock, Info, Leaf, ShieldCheck, TriangleAlert, Wind, House } from "lucide-react";
import type { Recommendation } from "@/types/recommendation";
import { Badge } from "@/components/ui/Badge";

const IMPACT: Record<Recommendation["impactType"], { label: string; icon: typeof Leaf }> = {
  "exposure-reduction": { label: "Less personal exposure", icon: ShieldCheck },
  "indoor-air": { label: "Cleaner indoor air", icon: House },
  "emissions-reduction": { label: "Lower emissions (CO₂e)", icon: Leaf },
  awareness: { label: "Better-informed decisions", icon: Info },
};
const CONFIDENCE_TONE = { high: "brand", medium: "info", low: "caution" } as const;

/**
 * Shows a recommendation with its full explanation: what, why, when,
 * triggering data, expected benefit type, confidence and limitations.
 */
export function RecommendationCard({ rec, headingLevel = "h3" }: { rec: Recommendation; headingLevel?: "h3" | "h4" }) {
  const Heading = headingLevel;
  const impact = IMPACT[rec.impactType];
  const ImpactIcon = impact.icon;
  return (
    <article className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" aria-label={rec.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading className="text-[0.95rem] font-semibold leading-snug text-ink">{rec.title}</Heading>
        {rec.recommendedTime ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-1 text-xs font-semibold text-ink-2">
            <Clock aria-hidden="true" className="size-3.5" />
            <span className="sr-only">When: </span>
            {rec.recommendedTime}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{rec.description}</p>
      {rec.caution ? (
        <p className="mt-2 flex gap-2 rounded-lg bg-caution-50 px-3 py-2 text-sm text-caution-800">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="sr-only">Caution: </span>
            {rec.caution}
          </span>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="neutral">
          <ImpactIcon aria-hidden="true" className="size-3.5" /> {impact.label}
        </Badge>
        <Badge tone={CONFIDENCE_TONE[rec.confidence]}>Confidence: {rec.confidence}</Badge>
      </div>
        <details className="group mt-3 text-sm">
          <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md font-semibold text-info-800 hover:underline">
            <Wind aria-hidden="true" className="size-4" /> Why this recommendation?
          </summary>
          <div className="mt-2 space-y-2 rounded-lg bg-canvas p-3 text-ink-2">
            <p>
              <strong className="text-ink">Reason:</strong> {rec.reason}
            </p>
            {rec.evidence.length ? (
              <div>
                <strong className="text-ink">Data behind it:</strong>
                <ul className="mt-1 list-disc pl-5">
                  {rec.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p>
              <strong className="text-ink">Source:</strong> {rec.source}
            </p>
            {rec.limitations.length ? (
              <div>
                <strong className="text-ink">Limitations:</strong>
                <ul className="mt-1 list-disc pl-5">
                  {rec.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
    </article>
  );
}
