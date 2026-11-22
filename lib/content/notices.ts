/** User-facing caveats shared by the engine and the UI, so wording stays identical everywhere. */

export const MODEL_LIMITATION = "Based on modelled forecasts, not monitoring-station measurements.";

export const NO_INDOOR_SENSOR_NOTE =
  "BreatheWise does not measure indoor air. Advice is based on modelled outdoor conditions only.";

export const GLOBAL_MODEL_NOTE =
  "The global model runs in 3-hour steps on a ~45 km grid, so hour-to-hour differences are approximate.";

export const SAMPLE_DATA_SOURCE = "Sample demo data (not real readings)";

/** Official Indian National AQI (CPCB) station readings. */
export const CPCB_URL = "https://airquality.cpcb.gov.in/AQI_India/";

/** Mask guidance for people exposed to roadside air on high-pollution hours. */
export const MASK_NOTE =
  "If you choose to wear a mask, a well-fitted N95/FFP2 respirator filters particles far better than cloth; it does not remove gases.";
