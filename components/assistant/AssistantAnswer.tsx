import { Bot, Clock, House, Leaf, TramFront, TriangleAlert } from "lucide-react";
import type { AssistantResponse } from "@/lib/ai/schema";
import { Badge } from "@/components/ui/Badge";
import type { AnswerSource } from "@/hooks/useAssistantChat";

/** Renders a validated structured answer. All content is rendered as text (never as HTML). */
export function AssistantAnswer({
  answer,
  source,
  notice,
}: {
  answer: AssistantResponse;
  source: AnswerSource;
  notice?: string;
}) {
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
      {notice ? <p className="text-ink-3 text-xs">{notice}</p> : null}
      <p className="text-ink text-[0.95rem] font-medium">{answer.summary}</p>
      <p className="text-ink-2 text-sm">
        <strong className="text-ink">Current conditions:</strong> {answer.risk_context}
      </p>
      <div>
        <h4 className="text-ink text-sm font-semibold">Top actions</h4>
        <ol className="mt-2 space-y-2">
          {answer.top_actions.map((a, i) => (
            <li key={`${i}-${a.action}`} className="border-line bg-surface rounded-lg border p-3 text-sm">
              <p className="text-ink font-semibold">
                {i + 1}. {a.action}
              </p>
              <p className="text-ink-2 mt-0.5">
                <span className="text-ink font-medium">Why:</span> {a.why}
              </p>
              <p className="text-ink-2 mt-0.5 flex items-center gap-1">
                <Clock aria-hidden="true" className="size-3.5" />
                <span className="text-ink font-medium">When:</span> {a.when}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink flex items-center gap-1.5 font-semibold">
            <Clock aria-hidden="true" className="size-4" /> Timing
          </dt>
          <dd className="text-ink-2 mt-0.5">{answer.timing}</dd>
        </div>
        <div>
          <dt className="text-ink flex items-center gap-1.5 font-semibold">
            <TramFront aria-hidden="true" className="size-4" /> Commute
          </dt>
          <dd className="text-ink-2 mt-0.5">{answer.commute_recommendation}</dd>
        </div>
        {answer.indoor_recommendations.length ? (
          <div>
            <dt className="text-ink flex items-center gap-1.5 font-semibold">
              <House aria-hidden="true" className="size-4" /> Indoors
            </dt>
            <dd className="text-ink-2 mt-0.5">
              <ul className="list-disc space-y-0.5 pl-5">
                {answer.indoor_recommendations.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-ink flex items-center gap-1.5 font-semibold">
            <Leaf aria-hidden="true" className="size-4" /> Environmental impact
          </dt>
          <dd className="text-ink-2 mt-0.5">{answer.environmental_impact}</dd>
        </div>
      </dl>
      <div className="bg-caution-50 text-caution-800 rounded-lg p-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <TriangleAlert aria-hidden="true" className="size-4" /> Uncertainties
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {answer.uncertainties.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </div>
      <p className="text-ink-3 text-xs">{answer.disclaimer}</p>
    </div>
  );
}
