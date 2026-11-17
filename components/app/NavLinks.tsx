"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/app/nav";
import { cn } from "@/components/ui/cn";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active ? "bg-navy-700 text-white" : "text-navy-200 hover:bg-navy-800 hover:text-white",
              )}
            >
              <Icon aria-hidden="true" className={cn("size-[18px]", active ? "text-brand-500" : "")} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
