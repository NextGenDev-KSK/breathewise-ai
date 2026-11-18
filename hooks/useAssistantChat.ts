"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { askGemini, fetchAssistantStatus } from "@/lib/ai/client";
import { buildAssistantContext } from "@/lib/ai/context";
import { buildRuleBasedAnswer } from "@/lib/ai/fallback";
import { AI_DISABLED_NOTICE, assistantModeLabel, FALLBACK_NOTICES } from "@/lib/ai/notices";
import { MAX_HISTORY, MAX_MESSAGE_LENGTH, type AssistantResponse } from "@/lib/ai/schema";

export type AnswerSource = { kind: "gemini"; model: string } | { kind: "rules" };

export interface Turn {
  id: number;
  question: string;
  /** null while the answer is loading. */
  answer: AssistantResponse | null;
  source: AnswerSource;
  /** Why the rule engine answered instead of Gemini, when that happened. */
  notice?: string;
}

/** Each previous turn contributes a short question and summary as conversation history. */
const HISTORY_TEXT_LIMIT = 1200;

function validateQuestion(question: string): string | null {
  if (!question) return "Please enter a question.";
  if (question.length > MAX_MESSAGE_LENGTH)
    return `Questions are limited to ${MAX_MESSAGE_LENGTH} characters.`;
  return null;
}

/**
 * Conversation state for the assistant. Uses Gemini when it is configured, enabled and local data
 * is available; otherwise (or on any AI failure) answers with the rule engine and says why.
 */
export function useAssistantChat() {
  const { air, preferences, nowMs, formatTime, settings } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const snapshot = air.snapshot;

  useEffect(() => {
    const controller = new AbortController();
    void fetchAssistantStatus(controller.signal).then(setConfigured);
    return () => {
      controller.abort();
      controllerRef.current?.abort();
    };
  }, []);

  const updateTurn = (id: number, patch: Partial<Turn>) =>
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      const invalid = validateQuestion(question);
      setError(invalid);
      if (invalid) return;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const id = nextId.current++;
      const ruleAnswer = () =>
        buildRuleBasedAnswer({ message: question, snapshot, preferences, nowMs, formatTime });

      if (!settings.aiEnabled || configured !== true || !snapshot) {
        const notice = !settings.aiEnabled
          ? AI_DISABLED_NOTICE
          : configured === false
            ? FALLBACK_NOTICES.ai_not_configured
            : undefined;
        setTurns((all) => [
          ...all,
          { id, question, answer: ruleAnswer(), source: { kind: "rules" }, notice },
        ]);
        return;
      }

      setPending(true);
      setTurns((all) => [...all, { id, question, answer: null, source: { kind: "rules" } }]);
      const history = turns.slice(-MAX_HISTORY / 2).flatMap((turn) => [
        { role: "user" as const, text: turn.question.slice(0, HISTORY_TEXT_LIMIT) },
        { role: "assistant" as const, text: (turn.answer?.summary ?? "").slice(0, HISTORY_TEXT_LIMIT) },
      ]);
      try {
        const result = await askGemini({
          message: question,
          history,
          context: buildAssistantContext(snapshot, preferences, nowMs),
          signal: controller.signal,
        });
        updateTurn(
          id,
          result.ok
            ? { answer: result.response, source: { kind: "gemini", model: result.model } }
            : { answer: ruleAnswer(), source: { kind: "rules" }, notice: FALLBACK_NOTICES[result.code] },
        );
      } catch {
        // Only an aborted request throws: a newer question replaced it, so drop this turn.
        setTurns((all) => all.filter((turn) => turn.id !== id));
      } finally {
        if (controllerRef.current === controller) setPending(false);
      }
    },
    [configured, formatTime, nowMs, preferences, settings.aiEnabled, snapshot, turns],
  );

  return {
    turns,
    pending,
    error,
    snapshot,
    modeLabel: assistantModeLabel({ aiEnabled: settings.aiEnabled, configured, hasData: snapshot !== null }),
    /** Fire-and-forget for event handlers; failures are already handled inside. */
    ask: (question: string) => void ask(question),
    clear: () => setTurns([]),
  };
}
