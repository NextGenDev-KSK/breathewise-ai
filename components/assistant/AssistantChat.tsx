"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { AssistantSidebar } from "@/components/assistant/AssistantSidebar";
import { Conversation } from "@/components/assistant/Conversation";
import { QuestionForm } from "@/components/assistant/QuestionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAssistantChat } from "@/hooks/useAssistantChat";

export function AssistantChat() {
  const chat = useAssistantChat();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card className="flex min-h-[32rem] flex-col">
        <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <p className="text-ink-2 flex items-center gap-2 text-sm font-medium" role="status">
            <Sparkles aria-hidden="true" className="text-brand-700 size-4" />
            {chat.modeLabel}
          </p>
          {chat.turns.length ? (
            <Button size="sm" variant="ghost" onClick={chat.clear}>
              <Trash2 aria-hidden="true" className="size-4" /> Clear conversation
            </Button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Conversation turns={chat.turns} snapshot={chat.snapshot} />
        </div>
        <QuestionForm pending={chat.pending} error={chat.error} onAsk={chat.ask} />
      </Card>
      <AssistantSidebar pending={chat.pending} onAsk={chat.ask} />
    </div>
  );
}
