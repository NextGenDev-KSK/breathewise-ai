/** Pollutants requested from Open-Meteo (names match the API variables exactly). */
export const POLLUTANT_KEYS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "carbon_monoxide",
  "ozone",
  "dust",
  "ammonia",
] as const;
export type PollutantKey = (typeof POLLUTANT_KEYS)[number];

/** Pollutants that have a US AQI sub-index in Open-Meteo. */
export const US_SUBINDEX_POLLUTANTS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "carbon_monoxide",
  "ozone",
] as const satisfies readonly PollutantKey[];
export type UsSubIndexPollutant = (typeof US_SUBINDEX_POLLUTANTS)[number];

export type PlaceSource = "search" | "geolocation" | "demo";

export interface Place {
  id: string;
  name: string;
  /** Region / state, when the geocoder provides one. */
  admin1?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  source: PlaceSource;
}

export type AirModelId = "cams_global" | "cams_europe" | "sample";

export interface AirModelInfo {
  id: AirModelId;
  name: string;
  provider: string;
  spatialResolution: string;
  temporalResolution: string;
  forecastLength: string;
  updateFrequency: string;
}

/** One hour of forecast data. `null` always means "not provided", never zero. */
export interface HourlyPoint {
  /** Local wall-clock time at the location, e.g. "2026-11-17T06:00". */
  time: string;
  /** Absolute instant for comparisons. */
  epochMs: number;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
  us_aqi: number | null;
  european_aqi: number | null;
}

export type DataOrigin = "live" | "cache" | "demo";

export interface CurrentConditions {
  time: string;
  epochMs: number;
  pollutants: Record<PollutantKey, number | null>;
  usAqi: number | null;
  europeanAqi: number | null;
  usSubIndices: Record<UsSubIndexPollutant, number | null>;
}

export interface AirQualitySnapshot {
  place: Place;
  timezone: string;
  timezoneAbbreviation: string;
  utcOffsetSeconds: number;
  current: CurrentConditions;
  hourly: HourlyPoint[];
  model: AirModelInfo;
  /** Epoch ms when this app received the data. */
  fetchedAt: number;
  origin: DataOrigin;
}
