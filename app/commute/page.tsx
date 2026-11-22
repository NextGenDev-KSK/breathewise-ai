import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { CommuteCalculator } from "@/components/commute/CommuteCalculator";
import { ErrandPlanner } from "@/components/commute/ErrandPlanner";
import { EmissionMethodology } from "@/components/commute/EmissionMethodology";

export const metadata: Metadata = { title: "Smart Commute" };

/** Route `/commute`: compares the CO₂e of the user's commute with a lower-emission alternative. */
export default function CommutePage() {
  return (
    <>
      <PageHeader
        title="Smart commute"
        description="Compare the estimated emissions of your regular trips with public transport, carpooling and other alternatives, and see what combining errands saves, using a transparent, documented method."
      />
      <div className="space-y-6">
        <CommuteCalculator />
        <ErrandPlanner />
        <EmissionMethodology />
      </div>
    </>
  );
}
