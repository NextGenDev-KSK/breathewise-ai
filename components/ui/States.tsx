import type { ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-line/70 animate-pulse rounded-lg motion-reduce:animate-none", className)}
    />
  );
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

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line-strong bg-surface flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
      {icon ? (
        <div
          aria-hidden="true"
          className="bg-brand-50 text-brand-700 mb-4 grid size-12 place-items-center rounded-full"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? <div className="text-ink-3 mt-2 max-w-md text-sm">{children}</div> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load air-quality data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-danger-50 flex flex-col items-start gap-4 rounded-2xl border border-red-200 p-6 sm:flex-row sm:items-center"
    >
      <AlertCircle aria-hidden="true" className="text-danger-700 size-6 shrink-0" />
      <div className="flex-1">
        <h2 className="text-danger-700 font-semibold">{title}</h2>
        <p className="text-ink-2 mt-1 text-sm">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw aria-hidden="true" className="size-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
