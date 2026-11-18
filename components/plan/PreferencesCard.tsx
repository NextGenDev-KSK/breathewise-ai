"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import type { Preferences } from "@/types/preferences";
import { Card, CardHeader } from "@/components/ui/Card";
import { PreferencesForm } from "@/components/plan/PreferencesForm";

/** Collapsible card holding the optional routine and household form. */
export function PreferencesCard({
  preferences,
  onSave,
}: {
  preferences: Preferences;
  onSave: (p: Preferences) => void;
}) {
  const [editing, setEditing] = useState(false);

  function save(p: Preferences) {
    onSave(p);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader
        icon={<Settings2 className="size-4" />}
        title="Your routine and household"
        description="Optional. Saved only in this browser and used to tailor the plan."
        action={
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
            aria-controls="prefs-form"
            className="text-brand-700 hover:bg-brand-50 min-h-11 rounded-lg px-3 text-sm font-semibold"
          >
            {editing ? "Close" : "Edit preferences"}
          </button>
        }
      />
      <div id="prefs-form" className="p-5" hidden={!editing}>
        {editing ? <PreferencesForm initial={preferences} onSubmit={save} /> : null}
      </div>
    </Card>
  );
}
