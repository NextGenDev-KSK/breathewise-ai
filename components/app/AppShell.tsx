"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NavLinks } from "@/components/app/NavLinks";
import { Logo } from "@/components/app/Logo";
import { LocationPicker } from "@/components/app/LocationPicker";
import { DataStatus } from "@/components/app/DataStatus";
import { DemoBanner } from "@/components/app/DemoBanner";
import { Onboarding } from "@/components/app/Onboarding";
import { Dialog } from "@/components/ui/Dialog";

function Attribution({ inverted = false }: { inverted?: boolean }) {
  const cls = inverted ? "text-navy-300 [&_a]:text-navy-200" : "text-ink-3 [&_a]:text-ink-2";
  return (
    <p className={`text-xs leading-relaxed ${cls}`}>
      Air-quality data:{" "}
      <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
        Open-Meteo
      </a>{" "}
      (CC BY 4.0), using{" "}
      <a className="underline underline-offset-2" href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer">
        Copernicus Atmosphere Monitoring Service
      </a>{" "}
      forecasts. Not medical advice.
    </p>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-950 lg:flex">
        <div className="px-5 py-5">
          <Link href="/" className="inline-block rounded-md" aria-label="BreatheWise AI home">
            <Logo inverted />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </nav>
        <div className="border-t border-navy-800 px-5 py-4">
          <Attribution inverted />
        </div>
      </aside>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigation menu" variant="drawer">
        <div className="px-2 pb-4">
          <Logo inverted />
        </div>
        <nav aria-label="Main">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </nav>
        <div className="mt-6 px-2">
          <Attribution inverted />
        </div>
      </Dialog>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:flex-nowrap lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-canvas"
                aria-label="Open navigation menu"
                aria-haspopup="dialog"
              >
                <Menu aria-hidden="true" className="size-5" />
              </button>
              <Link href="/" className="rounded-md" aria-label="BreatheWise AI home">
                <Logo />
              </Link>
            </div>
            <div className="order-last w-full lg:order-none lg:max-w-xl">
              <LocationPicker />
            </div>
            <div className="ml-auto">
              <DataStatus />
            </div>
          </div>
        </header>
        <DemoBanner />
        <main id="main" tabIndex={-1} className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-5 lg:hidden">
          <Attribution />
        </footer>
      </div>
      <Onboarding />
    </>
  );
}
