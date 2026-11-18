import { Wind } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { NO_INDOOR_SENSOR_NOTE } from "@/lib/content/notices";
import type { VentilationAdvice } from "@/lib/engine/indoor";

const STATUS = {
  favourable: { tone: "brand", label: "Ventilation favourable" },
  brief: { tone: "caution", label: "Ventilate briefly" },
  limit: { tone: "danger", label: "Limit ventilation" },
  unknown: { tone: "neutral", label: "No data" },
} as const;

/** Whether to open windows now, why, and when a cleaner hour is expected. */
export function VentilationCard({ advice }: { advice: VentilationAdvice }) {
  const status = STATUS[advice.status];
  return (
    <Card>
      <CardHeader
        icon={<Wind className="size-4" />}
        title="Ventilation right now"
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <div className="space-y-3 p-5">
        <p className="text-ink text-lg font-semibold">{advice.title}</p>
        <p className="text-ink-2 text-sm">{advice.description}</p>
        <p className="text-ink-2 text-sm">
          <strong className="text-ink">Why:</strong> {advice.reason}
        </p>
        {advice.evidence.length ? (
          <ul className="text-ink-2 list-disc pl-5 text-sm">
            {advice.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <p className="bg-info-50 text-info-800 rounded-lg px-3 py-2 text-xs">{NO_INDOOR_SENSOR_NOTE}</p>
      </div>
    </Card>
  );
}
