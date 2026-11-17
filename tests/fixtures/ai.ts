import type { AssistantResponse } from "@/lib/ai/schema";
import { buildAssistantContext } from "@/lib/ai/context";
import { normalizeAirQuality } from "@/lib/air/openMeteo";
import { DELHI, DELHI_NOW, delhiRaw, prefs } from "./builders";

export const delhiSnapshot = () => normalizeAirQuality(delhiRaw, DELHI, "cams_global", DELHI_NOW);
export const delhiContext = () => buildAssistantContext(delhiSnapshot(), prefs(), DELHI_NOW);

/** A grounded, schema-valid response that quotes only values present in the Delhi fixture. */
export const GOOD_RESPONSE: AssistantResponse = {
  summary: "Air in Delhi is unhealthy right now, so a short walk is better postponed to a comparatively cleaner hour.",
  risk_context: "The modelled US AQI is 152 (Unhealthy) and PM2.5 is 86.6 µg/m³, driven mainly by fine particles.",
  top_actions: [
    { action: "Delay your walk", why: "Forecast values are lower later in the day.", when: "Comparatively better window from the forecast" },
    { action: "Keep windows closed", why: "Outdoor particles are elevated.", when: "Now" },
  ],
  timing: "Check the forecast window; conditions remain elevated.",
  indoor_recommendations: ["Run an air purifier in the bedroom if you have one."],
  commute_recommendation: "Prefer metro where practical.",
  environmental_impact: "Public transport lowers CO2e emissions, which is separate from today's local AQI.",
  uncertainties: ["Model data, not a monitoring station."],
  disclaimer: "General guidance, not medical advice. No guarantee of protection.",
};
