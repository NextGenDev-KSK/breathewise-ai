import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { MissionTracker } from "@/components/progress/MissionTracker";

export const metadata: Metadata = { title: "My 7-Day Clean-Air Mission" };

/** Route `/progress`: the 7-day clean-air mission and its progress. */
export default function ProgressPage() {
  return (
    <>
      <PageHeader
        title="My 7-day clean-air mission"
        description="Build small habits that cut your exposure and your household's emissions, and track them over a week."
      />
      <MissionTracker />
    </>
  );
}
