import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanView } from "@/components/plan/PlanView";

export const metadata: Metadata = { title: "My Clean-Air Day" };

export default function PlanPage() {
  return (
    <>
      <PageHeader
        title="My Clean-Air Day"
        description="A personalised plan for morning, afternoon, evening and night, built from your local forecast and routine."
      />
      <PlanView />
    </>
  );
}
