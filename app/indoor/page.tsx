import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { IndoorView } from "@/components/indoor/IndoorView";

export const metadata: Metadata = { title: "Indoor Air Advisor" };

export default function IndoorPage() {
  return (
    <>
      <PageHeader
        title="Indoor air advisor"
        description="When to ventilate, how to handle cooking smoke and dust, and how to use air purifiers well, based on today's outdoor conditions."
      />
      <IndoorView />
    </>
  );
}
