import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  as: Heading = "h2",
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">{icon}</span> : null}
        <div className="min-w-0">
          <Heading id={id} className="text-base font-semibold text-ink">
            {title}
          </Heading>
          {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
