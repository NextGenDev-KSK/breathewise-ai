import { z } from "zod";
import { recordFromKeys } from "@/lib/collections";
import { POLLUTANT_KEYS, US_SUBINDEX_POLLUTANTS } from "@/types/air";

const n = z.number().finite().nullable();
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const PlaceSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(200),
  admin1: z.string().max(200).optional(),
  country: z.string().max(100),
  countryCode: z.string().max(3),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.enum(["search", "geolocation", "demo"]),
});

/** Validates a snapshot restored from localStorage before it is shown as cached data. */
export const SnapshotSchema = z.object({
  place: PlaceSchema,
  timezone: z.string().max(64),
  timezoneAbbreviation: z.string().max(16),
  utcOffsetSeconds: z.number().int(),
  current: z.object({
    time: localTime,
    epochMs: z.number(),
    pollutants: z.object(recordFromKeys(POLLUTANT_KEYS, () => n)),
    usAqi: n,
    europeanAqi: n,
    usSubIndices: z.object(recordFromKeys(US_SUBINDEX_POLLUTANTS, () => n)),
  }),
  hourly: z
    .array(
      z.object({
        time: localTime,
        epochMs: z.number(),
        pm2_5: n,
        pm10: n,
        nitrogen_dioxide: n,
        ozone: n,
        us_aqi: n,
        european_aqi: n,
      }),
    )
    .max(24 * 8),
  model: z.object({
    id: z.enum(["cams_global", "cams_europe", "sample"]),
    name: z.string(),
    provider: z.string(),
    spatialResolution: z.string(),
    temporalResolution: z.string(),
    forecastLength: z.string(),
    updateFrequency: z.string(),
  }),
  fetchedAt: z.number(),
  origin: z.enum(["live", "cache", "demo"]),
});
