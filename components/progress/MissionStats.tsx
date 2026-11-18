import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MISSION_DAYS, type MissionProgress } from "@/lib/engine/mission";

function StatCard({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-ink-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="tabular mt-1 text-3xl font-bold">{children}</p>
    </Card>
  );
}

export function MissionStats({ progress, dayIndex }: { progress: MissionProgress; dayIndex: number | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Mission day">
        {dayIndex !== null ? `${dayIndex + 1} of ${MISSION_DAYS}` : "Complete"}
      </StatCard>
      <StatCard label="Actions completed">
        {progress.totalCompleted}{" "}
        <span className="text-ink-3 text-base font-medium">
          / {progress.totalPossible} ({progress.percent}%)
        </span>
      </StatCard>
      <StatCard
        label={
          <>
            <Flame aria-hidden="true" className="size-3.5" /> Active-day streak
          </>
        }
      >
        {progress.streak}{" "}
        <span className="text-ink-3 text-base font-medium">day{progress.streak === 1 ? "" : "s"}</span>
      </StatCard>
    </div>
  );
}
