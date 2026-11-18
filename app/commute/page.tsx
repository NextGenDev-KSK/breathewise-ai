import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { CommuteCalculator } from "@/components/commute/CommuteCalculator";

export const metadata: Metadata = { title: "Smart Commute" };

export default function CommutePage() {
  return (
    <>
      <PageHeader
        title="Smart commute"
        description="Compare the estimated emissions of your regular trips with lower-emission alternatives, using a transparent, documented method."
      />
      <CommuteCalculator />
    </>
  );
}
