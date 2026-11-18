import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const SUGGESTED_QUESTIONS = [
  "Is it a good time to go walking?",
  "How can I improve air quality in my bedroom?",
  "My child has school tomorrow. What precautions should I consider?",
  "Suggest a low-emission commute.",
  "Create a daily routine for my family.",
  "Why is PM2.5 particularly concerning?",
  "What should I change based on today's pollution levels?",
] as const;

/** Suggested questions, plus a plain-language note on what is sent to the AI and how it is checked. */
export function AssistantSidebar({
  pending,
  onAsk,
}: {
  pending: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <aside aria-labelledby="suggest-heading" className="space-y-4">
      <Card className="p-4">
        <h2 id="suggest-heading" className="text-ink text-sm font-semibold">
          Try asking
        </h2>
        <ul className="mt-3 space-y-2">
          {SUGGESTED_QUESTIONS.map((question) => (
            <li key={question}>
              <button
                type="button"
                onClick={() => onAsk(question)}
                disabled={pending}
                className="border-line text-ink-2 hover:border-brand-600 hover:bg-brand-50 min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-60"
              >
                {question}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="text-ink-3 space-y-2 p-4 text-xs">
        <p className="text-ink-2 font-semibold">How answers are made</p>
        <p>
          Only your city name, the current air readings, the next 24 hours of forecast and your saved
          preferences are sent. Coordinates are never sent to the AI.
        </p>
        <p>
          Every AI answer is checked against a strict format and against the supplied numbers. If a check
          fails, the rule-based answer is shown instead.
        </p>
        <Badge tone="neutral">Not medical advice</Badge>
      </Card>
    </aside>
  );
}
