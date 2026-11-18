import { DataSources } from "@/components/settings/DataSources";
import { PreferenceSettings } from "@/components/settings/PreferenceSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";

export function SettingsPanel() {
  return (
    <div className="space-y-6">
      <PreferenceSettings />
      <PrivacySettings />
      <DataSources />
    </div>
  );
}
