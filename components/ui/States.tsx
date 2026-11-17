import type { ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-line/70 motion-reduce:animate-none", className)} />;
}

export function LoadingPanel({ label = "Loading air-quality data…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      {icon ? <div aria-hidden="true" className="mb-4 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">{icon}</div> : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? <div className="mt-2 max-w-md text-sm text-ink-3">{children}</div> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load air-quality data", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-danger-50 p-6 sm:flex-row sm:items-center">
      <AlertCircle aria-hidden="true" className="size-6 shrink-0 text-danger-700" />
      <div className="flex-1">
        <h2 className="font-semibold text-danger-700">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw aria-hidden="true" className="size-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
