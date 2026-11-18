import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForecastView } from "@/components/forecast/ForecastView";

export const metadata: Metadata = { title: "Forecast & best outdoor time" };

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
