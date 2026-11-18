"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { clearCache } from "@/lib/air/cache";
import { clearAllStored } from "@/lib/storage";

/** What is stored where, and a way to erase all of it. */
export function PrivacySettings() {
  const [confirmClear, setConfirmClear] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const clearEverything = () => {
    // Storage subscribers reset settings, preferences, place and progress to defaults immediately.
    clearAllStored();
    clearCache();
    setConfirmClear(false);
    toast("All local data was cleared from this browser.", "success");
    router.push("/");
  };

  return (
    <Card>
      <CardHeader icon={<ShieldCheck className="size-4" />} title="Privacy" />
      <div className="text-ink-2 space-y-3 p-5 text-sm">
        <ul className="list-disc space-y-1 pl-5">
          <li>No account, no tracking, no analytics.</li>
          <li>
            Settings, preferences, checklist and mission progress are stored only in this browser
            (localStorage).
          </li>
          <li>
            Detected location is rounded to about 1 km and used only to request air-quality data from
            Open-Meteo.
          </li>
          <li>The AI assistant never receives your coordinates. Conversations are not stored.</li>
        </ul>
        <Button variant="secondary" onClick={() => setConfirmClear(true)}>
          <Trash2 aria-hidden="true" className="size-4" /> Clear all local data
        </Button>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear all local data?"
        description="This removes your location, preferences, checklist, mission progress and saved data from this browser."
        confirmLabel="Clear data"
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearEverything}
      />
    </Card>
  );
}
