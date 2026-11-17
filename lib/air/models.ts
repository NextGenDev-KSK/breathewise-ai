import type { AirModelInfo } from "@/types/air";

/** Facts from https://open-meteo.com/en/docs/air-quality-api (verified 2026-11-17). */
export const AIR_MODELS: Record<"cams_global" | "cams_europe" | "sample", AirModelInfo> = {
  cams_global: {
    id: "cams_global",
    name: "CAMS Global atmospheric composition forecast",
    provider: "Copernicus Atmosphere Monitoring Service via Open-Meteo",
    spatialResolution: "about 45 km (0.4°) grid",
    temporalResolution: "3-hourly (hourly values are interpolated)",
    forecastLength: "5 days",
    updateFrequency: "every 12 hours",
  },
  cams_europe: {
    id: "cams_europe",
    name: "CAMS European air-quality forecast (ensemble)",
    provider: "Copernicus Atmosphere Monitoring Service via Open-Meteo",
    spatialResolution: "about 11 km (0.1°) grid",
    temporalResolution: "hourly",
    forecastLength: "4 days",
    updateFrequency: "daily",
  },
  sample: {
    id: "sample",
    name: "Built-in sample data (not real)",
    provider: "BreatheWise demo fixture",
    spatialResolution: "not applicable",
    temporalResolution: "hourly",
    forecastLength: "3 days",
    updateFrequency: "never: fixed pattern for demonstration",
  },
};

/**
 * Approximate CAMS European domain (25°W–45°E, 30°N–72°N). Inside it we request
 * the higher-resolution European model explicitly so the displayed model is accurate.
 */
export function selectModelForLocation(latitude: number, longitude: number): "cams_europe" | "cams_global" {
  const inEurope = latitude >= 30 && latitude <= 72 && longitude >= -25 && longitude <= 45;
  return inEurope ? "cams_europe" : "cams_global";
}
