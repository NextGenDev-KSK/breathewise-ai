import type { AssistantContext, AssistantResponse } from "@/lib/ai/schema";
import { formatDay } from "@/lib/time";

/**
 * Post-validation checks for model output. Rejects answers that make guarantees or that
 * quote pollutant or index values which do not appear in the supplied data.
 */
const FORBIDDEN = [
  /\bguarantee(s|d)?\b/i,
  /\b(completely|totally|perfectly|100%)\s+safe\b/i,
  /\brisk[- ]free\b/i,
  /\bcures?\b/i,
  /\bdiagnos(e|is|ed)\b/i,
];

const NEGATION = /\b(not|no|never|isn't|doesn't|cannot|can't|without|nor)\b[^.]*$/i;

function allText(r: AssistantResponse): string {
  return [
    r.summary,
    r.risk_context,
    ...r.top_actions.flatMap((a) => [a.action, a.why, a.when]),
    r.timing,
    ...r.indoor_recommendations,
    r.commute_recommendation,
    r.environmental_impact,
    ...r.uncertainties,
  ].join("\n");
}

function knownValues(ctx: AssistantContext): number[] {
  const values: number[] = [];
  for (const v of Object.values(ctx.current)) if (v !== null) values.push(v);
  for (const h of ctx.next24h) {
    if (h.pm2_5 !== null) values.push(h.pm2_5);
    if (h.us_aqi !== null) values.push(h.us_aqi);
  }
  if (ctx.concern) values.push(ctx.concern.value);
  return values;
}

function isSupported(n: number, known: number[]): boolean {
  // Allow rounding: within 1 unit or 5%, whichever is larger.
  return known.some((k) => Math.abs(k - n) <= Math.max(1, k * 0.05));
}

const RAW_TIMESTAMP = /\b(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\b/g;

/**
 * Safety net for display: rewrites raw "2026-11-18T15:00" timestamps as "15:00 today",
 * "15:00 tomorrow" or "Fri 20 Nov, 15:00", relative to the data's local date.
 */
export function humanizeTimestamps(response: AssistantResponse, localDate: string): AssistantResponse {
  const tomorrow = new Date(Date.parse(`${localDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const fix = (text: string) =>
    text.replace(RAW_TIMESTAMP, (_, day: string, time: string) =>
      day === localDate
        ? `${time} today`
        : day === tomorrow
          ? `${time} tomorrow`
          : `${formatDay(`${day}T${time}`)}, ${time}`,
    );
  return {
    ...response,
    summary: fix(response.summary),
    risk_context: fix(response.risk_context),
    top_actions: response.top_actions.map((a) => ({
      action: fix(a.action),
      why: fix(a.why),
      when: fix(a.when),
    })),
    timing: fix(response.timing),
    indoor_recommendations: response.indoor_recommendations.map(fix),
    commute_recommendation: fix(response.commute_recommendation),
    environmental_impact: fix(response.environmental_impact),
    uncertainties: response.uncertainties.map(fix),
    disclaimer: fix(response.disclaimer),
  };
}

/**
 * Lists claims in a model answer that the data cannot support: concentrations or AQI values not in the
 * context, guarantees or "completely safe" wording, medical claims (cures, diagnoses) and quantified
 * benefit claims. An empty list means the answer passed the grounding check.
 */
export function findUnsupportedClaims(response: AssistantResponse, ctx: AssistantContext): string[] {
  const issues: string[] = [];
  // The disclaimer may legitimately say "no guarantee", so it is excluded from these checks.
  const body = allText(response);
  for (const re of FORBIDDEN) {
    const global = new RegExp(re.source, "gi");
    for (const m of body.matchAll(global)) {
      // "not risk-free" or "no guarantee" are appropriate caveats, not claims.
      const before = body.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
      if (!NEGATION.test(before)) {
        issues.push(`forbidden phrase: ${re.source}`);
        break;
      }
    }
  }

  const known = knownValues(ctx);
  // Numbers directly followed by a concentration unit.
  for (const m of body.matchAll(/(\d+(?:\.\d+)?)\s*(?:µg\/m³|ug\/m3|μg\/m³|µg\/m3|micrograms)/gi)) {
    const n = Number(m[1]);
    if (!isSupported(n, known)) issues.push(`unsupported concentration: ${m[0]}`);
  }
  // Numbers directly attached to an AQI mention ("AQI 152", "AQI of 152", "152 AQI").
  for (const m of body.matchAll(
    /\bAQI(?:\s+(?:of|is|at|around|near|about))?\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:US |European )?AQI\b/gi,
  )) {
    const n = Number(m[1] ?? m[2]);
    if (!isSupported(n, known)) issues.push(`unsupported index value: ${m[0]}`);
  }
  // Quantified personal-benefit claims ("reduce exposure by 40%").
  if (/\b(reduc\w*|cut\w*|lower\w*)\b[^.]{0,60}\bby\s+\d+(\.\d+)?\s*%/i.test(body))
    issues.push("quantified benefit claim");
  return issues;
}
