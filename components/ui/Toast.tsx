"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/components/ui/cn";

type ToastTone = "success" | "info" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

const ICONS = { success: CheckCircle2, info: Info, error: TriangleAlert };
const STYLES: Record<ToastTone, string> = {
  success: "border-brand-100 text-brand-800",
  info: "border-blue-100 text-info-800",
  error: "border-red-200 text-danger-700",
};

/** Toasts are announced through polite (or assertive, for errors) live regions. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);
  const render = (tone: "polite" | "assertive") => (
    <div aria-live={tone} role={tone === "assertive" ? "alert" : "status"} className="contents">
      {toasts
        .filter((t) => (tone === "assertive" ? t.tone === "error" : t.tone !== "error"))
        .map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className={cn("animate-toast-in pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-raised)]", STYLES[t.tone])}>
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1 text-ink">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 grid size-8 place-items-center rounded-md text-ink-3 hover:bg-canvas" aria-label="Dismiss notification">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96">
        {render("polite")}
        {render("assertive")}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
