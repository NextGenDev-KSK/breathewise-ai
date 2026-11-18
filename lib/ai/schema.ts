import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

/** The structured answer the assistant must return. Validated on server AND client. */
export const AssistantResponseSchema = z.object({
  summary: text(700),
  risk_context: text(700),
  top_actions: z
    .array(z.object({ action: text(200), why: text(400), when: text(120) }))
    .min(1)
    .max(5),
  timing: text(400),
  indoor_recommendations: z.array(text(300)).max(5),
  commute_recommendation: text(400),
  environmental_impact: text(400),
  uncertainties: z.array(text(300)).min(1).max(5),
  disclaimer: text(400),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

/** JSON Schema sent to Gemini for constrained decoding (length limits are enforced by Zod afterwards). */
export const ASSISTANT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Direct answer to the question in 1–3 sentences." },
    risk_context: { type: "string", description: "What the supplied data says about current outdoor air, citing the supplied values only." },
    top_actions: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          why: { type: "string", description: "Reason grounded in the supplied data." },
          when: { type: "string", description: "Timing, using times from the supplied forecast." },
        },
        required: ["action", "why", "when"],
      },
    },
    timing: { type: "string" },
    indoor_recommendations: { type: "array", maxItems: 5, items: { type: "string" } },
    commute_recommendation: { type: "string" },
    environmental_impact: { type: "string", description: "Qualitative; greenhouse-gas effects kept separate from local air pollution." },
    uncertainties: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: [
    "summary",
    "risk_context",
    "top_actions",
    "timing",
    "indoor_recommendations",
    "commute_recommendation",
    "environmental_impact",
    "uncertainties",
    "disclaimer",
  ],
} as const;

const value = z.number().finite().min(0).max(100_000).nullable();
const shortText = (max: number) => z.string().max(max);
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

/**
 * The environmental snapshot the client sends with a question. Deliberately excludes
 * coordinates: only a place label and validated readings reach the model.
 */
export const AssistantContextSchema = z.object({
  place: z.object({ name: shortText(120), country: shortText(80) }),
  dataOrigin: z.enum(["live", "cache", "demo"]),
  observedAt: localTime,
  timezone: shortText(64),
  model: z.object({ name: shortText(120), spatialResolution: shortText(80), temporalResolution: shortText(80) }),
  current: z.object({
    pm2_5: value,
    pm10: value,
    nitrogen_dioxide: value,
    sulphur_dioxide: value,
    carbon_monoxide: value,
    ozone: value,
    us_aqi: value,
    european_aqi: value,
  }),
  concern: z.object({ level: z.number().int().min(0).max(5), value: z.number().finite().min(0).max(100_000), label: shortText(40), basis: shortText(40), standardLabel: shortText(60) }).nullable(),
  dominantPollutant: shortText(20).nullable(),
  next24h: z.array(z.object({ time: localTime, pm2_5: value, us_aqi: value })).max(30),
  outdoorWindow: z.object({ activity: shortText(40), start: localTime, end: localTime, verdict: shortText(20), levelLabel: shortText(20) }).nullable(),
  preferences: z.object({
    commuteMode: shortText(20),
    outdoorActivity: shortText(20),
    children: z.boolean(),
    olderAdults: z.boolean(),
    respiratorySensitivity: z.boolean(),
    airPurifier: z.boolean(),
    kitchenExhaust: z.boolean(),
  }),
  ruleRecommendations: z.array(z.object({ title: shortText(200), reason: shortText(500) })).max(8),
  isIndia: z.boolean(),
});
export type AssistantContext = z.infer<typeof AssistantContextSchema>;

/** Maximum accepted request body for POST /api/assistant (bytes). */
export const MAX_BODY_BYTES = 16 * 1024;

export const MAX_MESSAGE_LENGTH = 600;
export const MAX_HISTORY = 6;

export const AssistantRequestSchema = z.object({
  message: z.string().trim().min(1, "Please enter a question.").max(MAX_MESSAGE_LENGTH, `Questions are limited to ${MAX_MESSAGE_LENGTH} characters.`),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1200) }))
    .max(MAX_HISTORY)
    .default([]),
  context: AssistantContextSchema,
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/** API envelope returned by POST /api/assistant. */
export const AssistantApiSuccessSchema = z.object({
  source: z.literal("gemini"),
  model: z.string().max(80),
  response: AssistantResponseSchema,
});
export type AssistantApiSuccess = z.infer<typeof AssistantApiSuccessSchema>;

export const ASSISTANT_ERROR_CODES = [
  "invalid_request",
  "payload_too_large",
  "unsupported_media_type",
  "rate_limited",
  "ai_not_configured",
  "ai_timeout",
  "ai_rate_limited",
  "ai_unavailable",
  "ai_invalid_output",
] as const;
export type AssistantErrorCode = (typeof ASSISTANT_ERROR_CODES)[number];

export const AssistantApiErrorSchema = z.object({
  error: z.enum(ASSISTANT_ERROR_CODES),
  message: z.string().max(300),
});
