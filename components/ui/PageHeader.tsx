import type { ReactNode } from "react";

/** The page's single `h1`, with an optional description and actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-ink text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="text-ink-3 mt-1 max-w-2xl text-[0.95rem]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
