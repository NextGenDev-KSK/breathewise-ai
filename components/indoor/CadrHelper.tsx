"use client";

import { useId, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { recommendedCadr } from "@/lib/engine/indoor";

function cadrMessage(input: string): { text: string; invalid: boolean } {
  if (input.trim() === "") return { text: "Enter a room area to see a suggested minimum.", invalid: false };
  const area = Number(input);
  const result = recommendedCadr(area);
  if (!result) return { text: "Enter an area between 1 and 500 m².", invalid: true };
  return {
    text: `Look for a smoke CADR of at least about ${result.cfm} cfm (≈ ${result.m3h} m³/h) for ${area} m², assuming a standard 2.4 m ceiling.`,
    invalid: false,
  };
}

/** Suggests a minimum purifier CADR for a room size (AHAM two-thirds rule of thumb). */
export function CadrHelper() {
  const [area, setArea] = useState("12");
  const id = useId();
  const { text, invalid } = cadrMessage(area);
  return (
    <Card>
      <CardHeader
        icon={<Calculator className="size-4" />}
        title="Purifier size helper"
        description="A common rule of thumb (AHAM): smoke CADR in cfm ≥ two-thirds of the room's floor area in square feet."
      />
      <div className="p-5">
        <label htmlFor={id} className="text-ink block text-sm font-medium">
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
          className="border-line-strong mt-1 h-11 w-40 rounded-lg border px-3 text-sm"
        />
        <p
          id={`${id}-out`}
          aria-live="polite"
          className={cn("mt-3 text-sm", invalid ? "text-danger-700" : "text-ink-2")}
        >
          {text}
        </p>
      </div>
    </Card>
  );
}
