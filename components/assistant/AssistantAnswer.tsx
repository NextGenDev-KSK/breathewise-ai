import { Bot, Clock, House, Leaf, TramFront, TriangleAlert } from "lucide-react";
import type { AssistantResponse } from "@/lib/ai/schema";
import { Badge } from "@/components/ui/Badge";

/** Renders a validated structured answer. All content is rendered as text (never as HTML). */
export function AssistantAnswer({ answer, source, notice }: { answer: AssistantResponse; source: { kind: "gemini"; model: string } | { kind: "rules" }; notice?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {source.kind === "gemini" ? (
          <Badge tone="info">
            <Bot aria-hidden="true" className="size-3.5" /> Gemini · {source.model}
          </Badge>
        ) : (
          <Badge tone="caution">Rule-based answer (no AI used)</Badge>
        )}
      </div>
      {notice ? <p className="text-xs text-ink-3">{notice}</p> : null}
      <p className="text-[0.95rem] font-medium text-ink">{answer.summary}</p>
      <p className="text-sm text-ink-2">
        <strong className="text-ink">Current conditions:</strong> {answer.risk_context}
      </p>
      <div>
        <h4 className="text-sm font-semibold text-ink">Top actions</h4>
        <ol className="mt-2 space-y-2">
          {answer.top_actions.map((a, i) => (
            <li key={`${i}-${a.action}`} className="rounded-lg border border-line bg-surface p-3 text-sm">
              <p className="font-semibold text-ink">
                {i + 1}. {a.action}
              </p>
              <p className="mt-0.5 text-ink-2">
                <span className="font-medium text-ink">Why:</span> {a.why}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-ink-2">
                <Clock aria-hidden="true" className="size-3.5" />
                <span className="font-medium text-ink">When:</span> {a.when}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-ink"><Clock aria-hidden="true" className="size-4" /> Timing</dt>
          <dd className="mt-0.5 text-ink-2">{answer.timing}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-ink"><TramFront aria-hidden="true" className="size-4" /> Commute</dt>
          <dd className="mt-0.5 text-ink-2">{answer.commute_recommendation}</dd>
        </div>
        {answer.indoor_recommendations.length ? (
          <div>
            <dt className="flex items-center gap-1.5 font-semibold text-ink"><House aria-hidden="true" className="size-4" /> Indoors</dt>
            <dd className="mt-0.5 text-ink-2">
              <ul className="list-disc space-y-0.5 pl-5">
                {answer.indoor_recommendations.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-ink"><Leaf aria-hidden="true" className="size-4" /> Environmental impact</dt>
          <dd className="mt-0.5 text-ink-2">{answer.environmental_impact}</dd>
        </div>
      </dl>
      <div className="rounded-lg bg-caution-50 p-3 text-sm text-caution-800">
        <p className="flex items-center gap-1.5 font-semibold"><TriangleAlert aria-hidden="true" className="size-4" /> Uncertainties</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {answer.uncertainties.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-ink-3">{answer.disclaimer}</p>
    </div>
  );
}
