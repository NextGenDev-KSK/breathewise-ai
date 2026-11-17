import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { AppProvider } from "@/components/app/AppProvider";
import { ToastProvider } from "@/components/ui/Toast";

export function renderWithApp(ui: ReactNode) {
  return render(
    <ToastProvider>
      <AppProvider>{ui}</AppProvider>
    </ToastProvider>,
  );
}

export function seedStorage(entries: Record<string, unknown>) {
  for (const [k, v] of Object.entries(entries)) localStorage.setItem(`breathewise:v1:${k}`, JSON.stringify(v));
}
