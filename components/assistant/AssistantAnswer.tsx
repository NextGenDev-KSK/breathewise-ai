import type { ReactNode } from "react";
import { Bot, Clock, House, Leaf, TramFront, TriangleAlert, type LucideIcon } from "lucide-react";
import type { AssistantResponse } from "@/lib/ai/schema";
import { Badge } from "@/components/ui/Badge";
import type { AnswerSource } from "@/hooks/useAssistantChat";

function SourceBadge({ source }: { source: AnswerSource }) {
  return source.kind === "gemini" ? (
    <Badge tone="info">
      <Bot aria-hidden="true" className="size-3.5" /> Gemini · {source.model}
    </Badge>
  ) : (
    <Badge tone="caution">Rule-based answer (no AI used)</Badge>
  );
}

function TopActions({ actions }: { actions: AssistantResponse["top_actions"] }) {
  return (
    <div>
      <h4 className="text-ink text-sm font-semibold">Top actions</h4>
      <ol className="mt-2 space-y-2">
        {actions.map((a, i) => (
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
  );
}

function Detail({ icon: Icon, term, children }: { icon: LucideIcon; term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink flex items-center gap-1.5 font-semibold">
        <Icon aria-hidden="true" className="size-4" /> {term}
      </dt>
      <dd className="text-ink-2 mt-0.5">{children}</dd>
    </div>
  );
}

function BulletList({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={`${className} list-disc space-y-0.5 pl-5`.trim()}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function AnswerDetails({ answer }: { answer: AssistantResponse }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <Detail icon={Clock} term="Timing">
        {answer.timing}
      </Detail>
      <Detail icon={TramFront} term="Commute">
        {answer.commute_recommendation}
      </Detail>
      {answer.indoor_recommendations.length ? (
        <Detail icon={House} term="Indoors">
          <BulletList items={answer.indoor_recommendations} />
        </Detail>
      ) : null}
      <Detail icon={Leaf} term="Environmental impact">
        {answer.environmental_impact}
      </Detail>
    </dl>
  );
}

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
        <SourceBadge source={source} />
      </div>
      {notice ? <p className="text-ink-3 text-xs">{notice}</p> : null}
      <p className="text-ink text-[0.95rem] font-medium">{answer.summary}</p>
      <p className="text-ink-2 text-sm">
        <strong className="text-ink">Current conditions:</strong> {answer.risk_context}
      </p>
      <TopActions actions={answer.top_actions} />
      <AnswerDetails answer={answer} />
      <div className="bg-caution-50 text-caution-800 rounded-lg p-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <TriangleAlert aria-hidden="true" className="size-4" /> Uncertainties
        </p>
        <BulletList items={answer.uncertainties} className="mt-1" />
      </div>
      <p className="text-ink-3 text-xs">{answer.disclaimer}</p>
    </div>
  );
}
