import { z } from "zod";
import { NAQI_POLLUTANTS } from "@/lib/stations/naqi";

/**
 * The `/api/stations` contract. The server builds it from OpenAQ; the browser re-validates it before
 * rendering, exactly as it does for assistant answers.
 */

const ConcernLevelSchema = z.literal([0, 1, 2, 3, 4, 5]);

export const StationSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(120),
  /** Network that runs the station, e.g. "CPCB". */
  provider: z.string().max(80),
  countryCode: z.string().max(3),
  distanceKm: z.number().nonnegative(),
  /** When the station last reported, ISO 8601 UTC. */
  lastUpdated: z.iso.datetime(),
});
export type Station = z.infer<typeof StationSchema>;

export const StationReadingSchema = z.object({
  pollutant: z.enum(NAQI_POLLUTANTS),
  value: z.number().nonnegative(),
  unit: z.enum(["µg/m³", "mg/m³"]),
  /** End of the hour the value was measured in, ISO 8601 UTC. */
  measuredAt: z.iso.datetime(),
});
export type StationReading = z.infer<typeof StationReadingSchema>;

const SubIndexSchema = z.object({
  pollutant: z.enum(NAQI_POLLUTANTS),
  label: z.string().max(10),
  concentration: z.number().nonnegative(),
  index: z.number().int().min(0).max(401),
  aboveScale: z.boolean(),
});

export const NaqiSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    index: z.number().int().min(0).max(401),
    aboveScale: z.boolean(),
    category: z.enum(["Good", "Satisfactory", "Moderately polluted", "Poor", "Very poor", "Severe"]),
    level: ConcernLevelSchema,
    prominent: SubIndexSchema,
    subIndices: z.array(SubIndexSchema).max(7),
  }),
  z.object({ ok: z.literal(false), reason: z.string().max(200), subIndices: z.array(SubIndexSchema).max(7) }),
]);

export const StationReportSchema = z.object({
  source: z.literal("OpenAQ"),
  fetchedAt: z.iso.datetime(),
  /** Active stations within 25 km, nearest first. */
  stations: z.array(StationSchema).max(5),
  /**
   * Current readings at the nearest active monitor and its National AQI (India only). If that monitor
   * lacks the data for an index, the next nearest one that has it.
   */
  nearest: z
    .object({
      station: StationSchema,
      readings: z.array(StationReadingSchema).max(7),
      /** Null outside India, where the CPCB index does not apply. */
      naqi: NaqiSchema.nullable(),
    })
    .nullable(),
});
export type StationReport = z.infer<typeof StationReportSchema>;

export const STATION_ERROR_CODES = [
  "invalid_request",
  "forbidden_origin",
  "rate_limited",
  "stations_not_configured",
  "stations_timeout",
  "stations_rate_limited",
  "stations_unavailable",
] as const;
export type StationErrorCode = (typeof STATION_ERROR_CODES)[number];

export const StationErrorSchema = z.object({
  error: z.enum(STATION_ERROR_CODES),
  message: z.string().max(300),
});

/** Query parameters: coordinates are rounded to 0.01° (~1 km) before they go anywhere. */
export const StationQuerySchema = z.object({
  lat: z.coerce
    .number()
    .min(-90)
    .max(90)
    .transform((v) => Math.round(v * 100) / 100),
  lon: z.coerce
    .number()
    .min(-180)
    .max(180)
    .transform((v) => Math.round(v * 100) / 100),
});
