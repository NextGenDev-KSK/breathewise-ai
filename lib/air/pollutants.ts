import type { PollutantKey } from "@/types/air";

export interface PollutantInfo {
  key: PollutantKey;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
  commonSources: string;
  /**
   * WHO 2021 Air Quality Guideline (24-hour, or 8-hour peak for ozone), in µg/m³.
   * Shown for context only: a single hourly model value is not a 24-hour average.
   */
  whoGuideline: { value: number; averaging: string } | null;
}

export const POLLUTANTS: Record<PollutantKey, PollutantInfo> = {
  pm2_5: {
    key: "pm2_5",
    label: "Fine particles (PM2.5)",
    shortLabel: "PM2.5",
    unit: "µg/m³",
    description: "Particles small enough to reach deep into the lungs.",
    commonSources: "Vehicle exhaust, burning (crop, waste, wood), industry, cooking smoke.",
    whoGuideline: { value: 15, averaging: "24-hour" },
  },
  pm10: {
    key: "pm10",
    label: "Coarse particles (PM10)",
    shortLabel: "PM10",
    unit: "µg/m³",
    description: "Inhalable particles including road and construction dust.",
    commonSources: "Road dust, construction, unpaved surfaces, combustion.",
    whoGuideline: { value: 45, averaging: "24-hour" },
  },
  nitrogen_dioxide: {
    key: "nitrogen_dioxide",
    label: "Nitrogen dioxide (NO₂)",
    shortLabel: "NO₂",
    unit: "µg/m³",
    description: "A traffic-related gas that irritates the airways.",
    commonSources: "Road traffic, especially diesel; gas cooking indoors.",
    whoGuideline: { value: 25, averaging: "24-hour" },
  },
  sulphur_dioxide: {
    key: "sulphur_dioxide",
    label: "Sulphur dioxide (SO₂)",
    shortLabel: "SO₂",
    unit: "µg/m³",
    description: "A gas from burning sulphur-containing fuels.",
    commonSources: "Coal power plants, industry, some diesel fuels.",
    whoGuideline: { value: 40, averaging: "24-hour" },
  },
  carbon_monoxide: {
    key: "carbon_monoxide",
    label: "Carbon monoxide (CO)",
    shortLabel: "CO",
    unit: "µg/m³",
    description: "A gas from incomplete combustion.",
    commonSources: "Traffic, generators, biomass and charcoal burning.",
    whoGuideline: { value: 4000, averaging: "24-hour" },
  },
  ozone: {
    key: "ozone",
    label: "Ozone (O₃)",
    shortLabel: "O₃",
    unit: "µg/m³",
    description: "Forms in sunlight from other pollutants; often peaks in the afternoon.",
    commonSources: "Formed from vehicle and industrial emissions reacting in sunlight.",
    whoGuideline: { value: 100, averaging: "8-hour peak" },
  },
  dust: {
    key: "dust",
    label: "Mineral dust",
    shortLabel: "Dust",
    unit: "µg/m³",
    description: "Wind-blown desert and soil dust, modelled near the surface.",
    commonSources: "Desert dust transport, dry soils.",
    whoGuideline: null,
  },
  ammonia: {
    key: "ammonia",
    label: "Ammonia (NH₃)",
    shortLabel: "NH₃",
    unit: "µg/m³",
    description: "Contributes to particle formation. Modelled only for Europe.",
    commonSources: "Agriculture and fertiliser use.",
    whoGuideline: null,
  },
};

/** Pollutants shown on the main dashboard grid, in display order. */
export const PRIMARY_POLLUTANTS: PollutantKey[] = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "carbon_monoxide",
  "ozone",
];

/** Formats a concentration for display. Missing data is shown as missing, never as zero. */
export function formatConcentration(value: number | null | undefined, key: PollutantKey): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not available";
  const decimals = key === "carbon_monoxide" || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${POLLUTANTS[key].unit}`;
}

/** Ratio to the WHO guideline, for context. Returns null when either side is missing. */
export function guidelineRatio(value: number | null, key: PollutantKey): number | null {
  const g = POLLUTANTS[key].whoGuideline;
  if (value === null || !g) return null;
  return value / g.value;
}
