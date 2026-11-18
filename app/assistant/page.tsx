import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const metadata: Metadata = { title: "AI Clean-Air Assistant" };

/** Route `/assistant`: the AI clean-air assistant, grounded in the selected location's data. */
export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="AI clean-air assistant"
        description="Questions answered with your local air-quality data, with reasons and uncertainties. It works without AI too, using the rule engine."
      />
      <AssistantChat />
    </>
  );
}
