import { StationReportSchema, type StationReport } from "@/lib/stations/schema";
import capture from "@/lib/demo/stations-sample.json";

/**
 * SAMPLE station data for demo mode: a real OpenAQ response for CPCB-network monitors in central Delhi,
 * captured on 22 Nov 2026. It is validated like live data and always labelled as a sample in the UI.
 */
export const DEMO_STATION_REPORT: StationReport = StationReportSchema.parse(capture);
