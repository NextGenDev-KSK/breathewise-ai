"use client";

import { useId, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MAX_MESSAGE_LENGTH } from "@/lib/ai/schema";

interface QuestionFormProps {
  pending: boolean;
  error: string | null;
  onAsk: (question: string) => void;
}

/** The question box: Enter sends, Shift+Enter adds a line; length and errors are announced. */
export function QuestionForm({ pending, error, onAsk }: QuestionFormProps) {
  const [input, setInput] = useState("");
  const inputId = useId();
  const countId = useId();
  const errorId = useId();

  const send = () => {
    onAsk(input);
    if (input.trim() && input.trim().length <= MAX_MESSAGE_LENGTH) setInput("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="border-line border-t p-4"
    >
      <label htmlFor={inputId} className="text-ink text-sm font-semibold">
        Your question
      </label>
      <div className="mt-1.5 flex items-end gap-2">
        <textarea
          id={inputId}
          rows={2}
          value={input}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          aria-describedby={error ? `${countId} ${errorId}` : countId}
          aria-invalid={error ? true : undefined}
          placeholder="e.g. Is this evening better for a jog?"
          className="border-line-strong min-h-11 flex-1 resize-y rounded-lg border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="size-4" />
          )}
          <span className="sr-only sm:not-sr-only">Ask</span>
        </Button>
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs">
        <p id={errorId} role="alert" className="text-danger-700 font-semibold">
          {error}
        </p>
        <p id={countId} className="text-ink-3">
          {input.length}/{MAX_MESSAGE_LENGTH} characters. Enter to send, Shift+Enter for a new line.
        </p>
      </div>
    </form>
  );
}
