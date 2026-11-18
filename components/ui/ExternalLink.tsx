import type { ReactNode } from "react";
import { ExternalLink as ExternalIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** Show the "opens in new tab" icon (hidden from screen readers; they get text instead). */
  showIcon?: boolean;
}

/** A link to another site: opens in a new tab safely and tells screen-reader users it does. */
export function ExternalLink({ href, children, className, showIcon = true }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 underline underline-offset-2", className)}
    >
      {children}
      {showIcon ? <ExternalIcon aria-hidden="true" className="size-3.5" /> : null}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
