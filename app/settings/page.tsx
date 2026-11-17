import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const metadata: Metadata = { title: "Settings & Data Sources" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings & data sources" description="Control how BreatheWise works and see exactly where its information comes from." />
      <SettingsPanel />
    </>
  );
}
