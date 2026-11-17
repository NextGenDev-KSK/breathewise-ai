import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Air quality dashboard"
        description="What the air is like where you are, what it means, and what to do about it, with the data behind every suggestion."
      />
      <DashboardView />
    </>
  );
}
