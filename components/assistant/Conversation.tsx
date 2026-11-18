"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LoaderCircle, User } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { AssistantAnswer } from "@/components/assistant/AssistantAnswer";
import type { Turn } from "@/hooks/useAssistantChat";

function EmptyConversation({ snapshot }: { snapshot: AirQualitySnapshot | null }) {
  let subject = "your location once selected";
  if (snapshot) subject = snapshot.origin === "demo" ? "the sample location" : snapshot.place.name;
  return (
    <div className="py-6 text-center">
      <p className="text-ink text-base font-semibold">Ask about your air, your home or your commute</p>
      <p className="text-ink-3 mx-auto mt-1 max-w-md text-sm">
        Answers use the current data for {subject}. Conversations are not saved.
      </p>
      {!snapshot ? (
        <p className="mt-3 text-sm">
          <Link href="/" className="text-brand-700 font-semibold underline">
            Choose a location
          </Link>{" "}
          for answers based on local data.
        </p>
      ) : null}
    </div>
  );
}

/** The question/answer list; scrolls the newest turn into view (instantly if motion is reduced). */
export function Conversation({ turns, snapshot }: { turns: Turn[]; snapshot: AirQualitySnapshot | null }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.lastElementChild?.scrollIntoView?.({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [turns]);

  if (turns.length === 0) return <EmptyConversation snapshot={snapshot} />;

  return (
    <ol ref={listRef} aria-label="Conversation" className="space-y-6">
      {turns.map((turn) => (
        <li key={turn.id} className="space-y-3">
          <div className="flex justify-end">
            <p className="bg-navy-900 flex max-w-[85%] items-start gap-2 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white">
              <User aria-hidden="true" className="text-navy-300 mt-0.5 size-4 shrink-0" />
              <span>
                <span className="sr-only">You asked: </span>
                {turn.question}
              </span>
            </p>
          </div>
          <div
            className="border-line bg-canvas rounded-2xl rounded-bl-sm border p-4"
            aria-live="polite"
            aria-busy={!turn.answer}
          >
            {turn.answer ? (
              <AssistantAnswer answer={turn.answer} source={turn.source} notice={turn.notice} />
            ) : (
              <p className="text-ink-3 flex items-center gap-2 text-sm">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Thinking with your local
                data…
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
