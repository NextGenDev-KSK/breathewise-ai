export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#10b981" />
      <path d="M7 13.5h11.5a3.5 3.5 0 1 0-3.4-4.3" fill="none" stroke="#0a1222" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M7 19h15.5a3.5 3.5 0 1 1-3.4 4.3" fill="none" stroke="#0a1222" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-[family-name:var(--font-display)] text-[1.05rem] font-bold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>
        BreatheWise <span className={inverted ? "text-brand-500" : "text-brand-700"}>AI</span>
      </span>
    </span>
  );
}
