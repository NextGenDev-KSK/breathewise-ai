"use client";

import { useId, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import type { Place } from "@/types/air";
import { useApp } from "@/components/app/AppProvider";
import { DetectLocationButton } from "@/components/app/DetectLocationButton";
import { PlaceListbox } from "@/components/app/PlaceListbox";
import { useToast } from "@/components/ui/Toast";
import { searchStatusText, useCitySearch } from "@/hooks/useCitySearch";
import { useCombobox } from "@/hooks/useCombobox";
import { MAX_QUERY_LENGTH, placeLabel, sanitizeQuery } from "@/lib/air/geocoding";

/**
 * City search following the WAI-ARIA 1.2 combobox pattern, plus an opt-in
 * "use my location" button. Searches are debounced and outdated requests are aborted.
 */
export function LocationPicker({ inputId = "location-search" }: { inputId?: string }) {
  const { selectPlace, recentPlaces } = useApp();
  const toast = useToast();
  const [input, setInput] = useState("");
  const search = useCitySearch(input);
  const listId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const recent = !search.query && recentPlaces.length > 0;
  const options = search.query ? search.results : recentPlaces;

  const combobox = useCombobox({ options, onChoose: choose, onClear: () => setInput(""), containerRef });
  // A function declaration (hoisted), because the combobox needs it and it needs the combobox.
  function choose(place: Place) {
    selectPlace(place);
    setInput("");
    combobox.setOpen(false);
    combobox.setActive(-1);
    toast(`Showing air quality for ${placeLabel(place)}.`, "success");
  }
  const expanded =
    combobox.open && (options.length > 0 || search.status === "done" || search.status === "error");
  const activeId =
    expanded && combobox.activeIndex >= 0 ? `${listId}-opt-${combobox.activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="flex w-full items-center gap-2">
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
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search a city, e.g. Pune"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            combobox.setOpen(true);
            // The first result becomes active when results arrive, so Enter picks it.
            combobox.setActive(sanitizeQuery(e.target.value) ? 0 : -1);
          }}
          onFocus={() => combobox.setOpen(true)}
          onKeyDown={combobox.onKeyDown}
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
        <PlaceListbox
          id={listId}
          places={options}
          recent={recent}
          expanded={expanded}
          activeIndex={combobox.activeIndex}
          status={search.status}
          onChoose={choose}
          onHover={combobox.setActive}
        />
      </div>
      <DetectLocationButton />
    </div>
  );
}
