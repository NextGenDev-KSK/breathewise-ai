import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForecastView } from "@/components/forecast/ForecastView";

export const metadata: Metadata = { title: "Forecast & best outdoor time" };

/** Route `/forecast`: hourly and daily forecasts plus the outdoor-window planner. */
export default function ForecastPage() {
  return (
    <>
      <PageHeader
        title="Forecast & best outdoor time"
        description="Plan activities around comparatively cleaner hours. Forecasts are model estimates, not measurements."
      />
      <ForecastView />
    </>
  );
}
