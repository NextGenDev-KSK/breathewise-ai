"use client";

import { useMemo } from "react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { AirDataGate } from "@/components/air/AirDataGate";
import { CadrHelper } from "@/components/indoor/CadrHelper";
import { IndoorChecklist } from "@/components/indoor/IndoorChecklist";
import { IndoorGuide } from "@/components/indoor/IndoorGuide";
import { VentilationCard } from "@/components/indoor/VentilationCard";
import { currentConcern } from "@/lib/engine/analysis";
import { buildIndoorChecklist, getVentilationAdvice } from "@/lib/engine/indoor";

function Indoor({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, nowMs, formatTime } = useApp();
  const advice = useMemo(
    () => getVentilationAdvice(snapshot, nowMs, formatTime),
    [snapshot, nowMs, formatTime],
  );
  const level = currentConcern(snapshot)?.level ?? null;
  const items = useMemo(() => buildIndoorChecklist(preferences, level), [preferences, level]);

  return (
    <div className="space-y-6">
      <VentilationCard advice={advice} />
      <IndoorChecklist items={items} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <IndoorGuide />
        <CadrHelper />
      </div>
    </div>
  );
}

export function IndoorView() {
  return <AirDataGate>{(snapshot) => <Indoor snapshot={snapshot} />}</AirDataGate>;
}
