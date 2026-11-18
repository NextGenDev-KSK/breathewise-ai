import { DataSources } from "@/components/settings/DataSources";
import { PreferenceSettings } from "@/components/settings/PreferenceSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";

/** The settings page: display preferences, privacy controls and data sources. */
export function SettingsPanel() {
  return (
    <div className="space-y-6">
      <PreferenceSettings />
      <PrivacySettings />
      <DataSources />
    </div>
  );
}
