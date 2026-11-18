import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { AppProvider } from "@/components/app/AppProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_SETTINGS } from "@/types/preferences";

/** The providers every page renders inside (app state + toasts); also usable as a `renderHook` wrapper. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppProvider>{children}</AppProvider>
    </ToastProvider>
  );
}

/** Renders a component inside the app providers. */
export function renderWithApp(ui: ReactNode) {
  return render(<AppProviders>{ui}</AppProviders>);
}

/** Writes values to localStorage under the app's versioned keys, before the app reads them. */
export function seedStorage(entries: Record<string, unknown>) {
  for (const [k, v] of Object.entries(entries))
    localStorage.setItem(`breathewise:v1:${k}`, JSON.stringify(v));
}

/** Turns on sample-data mode with onboarding done, so views render the captured Delhi snapshot. */
export function seedDemoMode() {
  seedStorage({ settings: { ...DEFAULT_SETTINGS, demoMode: true, onboarded: true } });
}
