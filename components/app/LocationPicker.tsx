"use client";

import { useEffect, useId, useRef, useState } from "react";
import { History, LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import type { Place } from "@/types/air";
import { GeocodingError, MAX_QUERY_LENGTH, placeLabel, sanitizeQuery, searchPlaces } from "@/lib/air/geocoding";
import { useDetectLocation } from "@/hooks/useDetectLocation";
import { useApp } from "@/components/app/AppProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

const DEBOUNCE_MS = 300;

/**
 * City search following the WAI-ARIA 1.2 combobox pattern, plus an opt-in
 * "use my location" button. Searches are debounced and outdated requests are aborted.
 */
export function LocationPicker({ inputId = "location-search" }: { inputId?: string }) {
  const { selectPlace, recentPlaces } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const { detect, locating } = useDetectLocation();
  const listId = useId();
  const statusId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmed = sanitizeQuery(query);
  const showingRecent = !trimmed && recentPlaces.length > 0;
  const options = trimmed ? results : recentPlaces;

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("searching");
      searchPlaces(trimmed, { signal: controller.signal })
        .then((places) => {
          setResults(places);
          setActive(places.length ? 0 : -1);
          setStatus("done");
        })
        .catch((err: unknown) => {
          if (err instanceof GeocodingError && err.kind === "aborted") return;
          setResults([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function choose(place: Place) {
    selectPlace(place);
    setQuery("");
    setResults([]);
    setOpen(false);
    setStatus("idle");
    toast(`Showing air quality for ${placeLabel(place)}.`, "success");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : -1));
    } else if (e.key === "Enter") {
      const target = options[active];
      if (open && target) {
        e.preventDefault();
        choose(target);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else setQuery("");
    }
  }

  const expanded = open && (options.length > 0 || status === "done" || status === "error");
  let statusText = "";
  if (trimmed && status === "searching") statusText = "Searching…";
  else if (trimmed && status === "done") statusText = results.length ? `${results.length} location${results.length === 1 ? "" : "s"} found. Use up and down arrows to choose.` : "No matching locations found.";
  else if (status === "error") statusText = "Location search is unavailable right now.";

  return (
    <div ref={wrapperRef} className="flex w-full items-center gap-2">
      <div className="relative flex-1">
        <label htmlFor={inputId} className="sr-only">
          Search for a city
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={statusId}
          aria-activedescendant={expanded && active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search a city, e.g. Pune"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setOpen(true);
            if (!sanitizeQuery(value)) {
              setResults([]);
              setStatus("idle");
              setActive(-1);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-3 focus:border-info-700"
        />
        {status === "searching" ? <LoaderCircle aria-hidden="true" className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-3" /> : null}
        <p id={statusId} role="status" className="sr-only">
          {statusText}
        </p>
        <ul
          id={listId}
          role="listbox"
          aria-label={showingRecent ? "Recent locations" : "Matching locations"}
          hidden={!expanded}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-raised)]"
        >
          {showingRecent ? <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Recent</li> : null}
          {options.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              aria-label={[p.name, p.admin1, p.country].filter(Boolean).join(", ")}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === active ? "bg-brand-50 text-ink" : "text-ink-2")}
            >
              {showingRecent ? <History aria-hidden="true" className="size-4 shrink-0 text-ink-3" /> : <MapPin aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
              <span>
                <span className="font-medium text-ink">{p.name}</span>
                <span className="block text-xs text-ink-3">{[p.admin1, p.country].filter(Boolean).join(", ")}</span>
              </span>
            </li>
          ))}
          {trimmed && status === "done" && results.length === 0 ? <li role="presentation" className="px-3 py-3 text-sm text-ink-3">No matching locations. Check the spelling or try a nearby larger city.</li> : null}
          {status === "error" ? <li role="presentation" className="px-3 py-3 text-sm text-danger-700">Search is unavailable. Check your connection and try again.</li> : null}
        </ul>
      </div>
      <button
        type="button"
        onClick={detect}
        disabled={locating}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-2 hover:bg-canvas disabled:opacity-70"
        title="Uses your browser's location prompt. Coordinates are rounded to about 1 km and stay in your browser."
      >
        {locating ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <LocateFixed aria-hidden="true" className="size-4" />}
        <span className="hidden sm:inline">{locating ? "Locating…" : "Use my location"}</span>
        <span className="sr-only sm:hidden">Use my location</span>
      </button>
    </div>
  );
}
