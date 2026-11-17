"use client";

import { useId, useMemo, useState } from "react";
import { z } from "zod";
import { BookOpen, Calculator, CheckCircle2, ListChecks, Wind } from "lucide-react";
import type { AirQualitySnapshot } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { AirDataGate } from "@/components/air/AirDataGate";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { usePersistentState } from "@/hooks/usePersistentState";
import { STORAGE_KEYS } from "@/lib/storage";
import { buildIndoorChecklist, getVentilationAdvice, NO_INDOOR_SENSOR_NOTE, recommendedCadr } from "@/lib/engine/indoor";
import { currentConcern } from "@/lib/engine/analysis";
import { INDOOR_GUIDE } from "@/lib/content/indoorGuide";
import { todayIso } from "@/lib/engine/mission";

const ChecklistSchema = z.object({ date: z.string().max(10), done: z.array(z.string().max(40)).max(50) });
type ChecklistState = z.infer<typeof ChecklistSchema>;
const EMPTY: ChecklistState = { date: "", done: [] };

const STATUS = {
  favourable: { tone: "brand", label: "Ventilation favourable" },
  brief: { tone: "caution", label: "Ventilate briefly" },
  limit: { tone: "danger", label: "Limit ventilation" },
  unknown: { tone: "neutral", label: "No data" },
} as const;

const today = () => todayIso();

function CadrHelper() {
  const [area, setArea] = useState("12");
  const id = useId();
  const value = Number(area);
  const result = area.trim() === "" ? null : recommendedCadr(value);
  const invalid = area.trim() !== "" && result === null;
  return (
    <Card>
      <CardHeader icon={<Calculator className="size-4" />} title="Purifier size helper" description="A common rule of thumb (AHAM): smoke CADR in cfm ≥ two-thirds of the room's floor area in square feet." />
      <div className="p-5">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          Room floor area (m²)
        </label>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={1}
          max={500}
          step="0.5"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={`${id}-out`}
          className="mt-1 h-11 w-40 rounded-lg border border-line-strong px-3 text-sm"
        />
        <p id={`${id}-out`} aria-live="polite" className={cn("mt-3 text-sm", invalid ? "text-danger-700" : "text-ink-2")}>
          {invalid
            ? "Enter an area between 1 and 500 m²."
            : result
              ? `Look for a smoke CADR of at least about ${result.cfm} cfm (≈ ${result.m3h} m³/h) for ${value} m², assuming a standard 2.4 m ceiling.`
              : "Enter a room area to see a suggested minimum."}
        </p>
      </div>
    </Card>
  );
}

function Indoor({ snapshot }: { snapshot: AirQualitySnapshot }) {
  const { preferences, nowMs, formatTime } = useApp();
  const advice = useMemo(() => getVentilationAdvice(snapshot, nowMs, formatTime), [snapshot, nowMs, formatTime]);
  const level = currentConcern(snapshot)?.level ?? null;
  const items = useMemo(() => buildIndoorChecklist(preferences, level), [preferences, level]);
  const [stored, setStored] = usePersistentState(STORAGE_KEYS.indoorChecklist, ChecklistSchema, EMPTY);
  // Checklist progress resets each day.
  const done = stored.date === today() ? new Set(stored.done) : new Set<string>();
  const completed = items.filter((i) => done.has(i.id)).length;

  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStored({ date: today(), done: [...next] });
  };

  const status = STATUS[advice.status];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={<Wind className="size-4" />} title="Ventilation right now" action={<Badge tone={status.tone}>{status.label}</Badge>} />
        <div className="space-y-3 p-5">
          <p className="text-lg font-semibold text-ink">{advice.title}</p>
          <p className="text-sm text-ink-2">{advice.description}</p>
          <p className="text-sm text-ink-2">
            <strong className="text-ink">Why:</strong> {advice.reason}
          </p>
          {advice.evidence.length ? (
            <ul className="list-disc pl-5 text-sm text-ink-2">
              {advice.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <p className="rounded-lg bg-info-50 px-3 py-2 text-xs text-info-800">{NO_INDOOR_SENSOR_NOTE}</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<ListChecks className="size-4" />}
          title="Today's indoor checklist"
          description="Personalised from your equipment, household and today's outdoor level. Progress is saved in this browser and resets daily."
          action={
            <span className="text-sm font-semibold text-ink-2" aria-live="polite">
              {completed} of {items.length} done
            </span>
          }
        />
        <div className="px-5 pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={completed}>
            <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} />
          </div>
        </div>
        <ul className="divide-y divide-line px-2 py-2 sm:px-3">
          {items.map((item) => {
            const checked = done.has(item.id);
            const inputId = `check-${item.id}`;
            return (
              <li key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-canvas">
                <input id={inputId} type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="mt-0.5 size-5 shrink-0 accent-brand-700" aria-describedby={`${inputId}-d`} />
                <label htmlFor={inputId} className="flex-1 cursor-pointer">
                  <span className={cn("block text-sm font-medium", checked ? "text-ink-3 line-through" : "text-ink")}>{item.title}</span>
                  <span id={`${inputId}-d`} className="block text-xs text-ink-3">
                    {item.detail}
                  </span>
                </label>
                <Badge tone="neutral" className="hidden capitalize sm:inline-flex">
                  {item.category}
                </Badge>
              </li>
            );
          })}
        </ul>
        {completed === items.length && items.length > 0 ? (
          <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-sm font-semibold text-brand-800">
            <CheckCircle2 aria-hidden="true" className="size-4" /> All done for today. Nice work.
          </p>
        ) : null}
        {completed > 0 ? (
          <div className="border-t border-line px-5 py-3">
            <Button size="sm" variant="ghost" onClick={() => setStored({ date: today(), done: [] })}>
              Clear today&apos;s checks
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader icon={<BookOpen className="size-4" />} title="Indoor air guide" description="Practical, general guidance. Open a topic to read more." />
          <div className="divide-y divide-line">
            {INDOOR_GUIDE.map((s) => (
              <details key={s.id} className="group px-5 py-3">
                <summary className="flex min-h-10 cursor-pointer items-center justify-between font-semibold text-ink">
                  {s.title}
                  <span aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-1 text-sm text-ink-2">{s.intro}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Card>
        <CadrHelper />
      </div>
    </div>
  );
}

export function IndoorView() {
  return <AirDataGate>{(s) => <Indoor snapshot={s} />}</AirDataGate>;
}
