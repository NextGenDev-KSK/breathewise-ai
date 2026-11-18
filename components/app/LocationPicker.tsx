"use client";

import { useEffect, useId, useRef, useState } from "react";
import { History, LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import type { Place } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { searchStatusText, useCitySearch } from "@/hooks/useCitySearch";
import { useDetectLocation } from "@/hooks/useDetectLocation";
import { MAX_QUERY_LENGTH, placeLabel, sanitizeQuery } from "@/lib/air/geocoding";

const regionAndCountry = (place: Place) => [place.admin1, place.country].filter(Boolean).join(", ");

/**
 * City search following the WAI-ARIA 1.2 combobox pattern, plus an opt-in
 * "use my location" button. Searches are debounced and outdated requests are aborted.
 */
export function LocationPicker({ inputId = "location-search" }: { inputId?: string }) {
  const { selectPlace, recentPlaces } = useApp();
  const toast = useToast();
  const { detect, locating } = useDetectLocation();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const search = useCitySearch(input);
  const listId = useId();
  const statusId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showingRecent = !search.query && recentPlaces.length > 0;
  const options = search.query ? search.results : recentPlaces;
  const activeIndex = active < options.length ? active : -1;
  const expanded = open && (options.length > 0 || search.status === "done" || search.status === "error");

  useEffect(() => {
    const closeOnOutsidePointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  const choose = (place: Place) => {
    selectPlace(place);
    setInput("");
    setOpen(false);
    setActive(-1);
    toast(`Showing air quality for ${placeLabel(place)}.`, "success");
  };

  const moveActive = (step: 1 | -1) =>
    setActive((index) => (options.length ? (index + step + options.length) % options.length : -1));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActive(-1);
        break;
      case "Enter": {
        const target = options[activeIndex];
        if (open && target) {
          e.preventDefault();
          choose(target);
        }
        break;
      }
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        } else {
          setInput("");
        }
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="flex w-full items-center gap-2">
      <div className="relative flex-1">
        <label htmlFor={inputId} className="sr-only">
          Search for a city
        </label>
        <Search
          aria-hidden="true"
          className="text-ink-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={statusId}
          aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search a city, e.g. Pune"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            // The first result becomes active when results arrive, so Enter picks it.
            setActive(sanitizeQuery(e.target.value) ? 0 : -1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="border-line-strong bg-surface text-ink placeholder:text-ink-3 focus:border-info-700 h-11 w-full rounded-lg border pr-9 pl-9 text-sm"
        />
        {search.status === "searching" ? (
          <LoaderCircle
            aria-hidden="true"
            className="text-ink-3 absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
          />
        ) : null}
        <p id={statusId} role="status" className="sr-only">
          {searchStatusText(search)}
        </p>
        <ul
          id={listId}
          role="listbox"
          aria-label={showingRecent ? "Recent locations" : "Matching locations"}
          hidden={!expanded}
          className="border-line bg-surface absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-auto rounded-xl border p-1 shadow-[var(--shadow-raised)]"
        >
          {showingRecent ? (
            <li
              role="presentation"
              className="text-ink-3 px-3 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase"
            >
              Recent
            </li>
          ) : null}
          {options.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              aria-label={[place.name, place.admin1, place.country].filter(Boolean).join(", ")}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                index === activeIndex ? "bg-brand-50 text-ink" : "text-ink-2",
              )}
            >
              {showingRecent ? (
                <History aria-hidden="true" className="text-ink-3 size-4 shrink-0" />
              ) : (
                <MapPin aria-hidden="true" className="text-ink-3 size-4 shrink-0" />
              )}
              <span>
                <span className="text-ink font-medium">{place.name}</span>
                <span className="text-ink-3 block text-xs">{regionAndCountry(place)}</span>
              </span>
            </li>
          ))}
          {search.status === "done" && search.results.length === 0 ? (
            <li role="presentation" className="text-ink-3 px-3 py-3 text-sm">
              No matching locations. Check the spelling or try a nearby larger city.
            </li>
          ) : null}
          {search.status === "error" ? (
            <li role="presentation" className="text-danger-700 px-3 py-3 text-sm">
              Search is unavailable. Check your connection and try again.
            </li>
          ) : null}
        </ul>
      </div>
      <button
        type="button"
        onClick={detect}
        disabled={locating}
        className="border-line-strong bg-surface text-ink-2 hover:bg-canvas inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-70"
        title="Uses your browser's location prompt. Coordinates are rounded to about 1 km and stay in your browser."
      >
        {locating ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <LocateFixed aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only sm:not-sr-only">{locating ? "Locating…" : "Use my location"}</span>
      </button>
    </div>
  );
}
