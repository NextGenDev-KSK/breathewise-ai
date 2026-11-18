"use client";

import { AirDataGate } from "@/components/air/AirDataGate";
import { DailyOverview } from "@/components/forecast/DailyOverview";
import { ForecastChartCard } from "@/components/forecast/ForecastChartCard";
import { OutdoorWindowPlanner } from "@/components/forecast/OutdoorWindowPlanner";

export function ForecastView() {
  return (
    <AirDataGate>
      {(snapshot) => (
        <div className="space-y-6">
          <OutdoorWindowPlanner snapshot={snapshot} />
          <ForecastChartCard snapshot={snapshot} />
          <DailyOverview snapshot={snapshot} />
        </div>
      )}
    </AirDataGate>
  );
}
