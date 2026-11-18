import { History, MapPin } from "lucide-react";
import type { Place } from "@/types/air";
import { cn } from "@/components/ui/cn";
import type { SearchStatus } from "@/hooks/useCitySearch";

const regionAndCountry = (place: Place) => [place.admin1, place.country].filter(Boolean).join(", ");

interface PlaceListboxProps {
  id: string;
  places: readonly Place[];
  /** True when showing recently chosen places rather than search results. */
  recent: boolean;
  expanded: boolean;
  activeIndex: number;
  status: SearchStatus;
  onChoose: (place: Place) => void;
  onHover: (index: number) => void;
}

/** The combobox popup: recent places or search results, plus empty and error messages. */
export function PlaceListbox({
  id,
  places,
  recent,
  expanded,
  activeIndex,
  status,
  onChoose,
  onHover,
}: PlaceListboxProps) {
  const Icon = recent ? History : MapPin;
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={recent ? "Recent locations" : "Matching locations"}
      hidden={!expanded}
      className="border-line bg-surface absolute top-full right-0 left-0 z-40 mt-1 max-h-80 overflow-auto rounded-xl border p-1 shadow-[var(--shadow-raised)]"
    >
      {recent ? (
        <li
          role="presentation"
          className="text-ink-3 px-3 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase"
        >
          Recent
        </li>
      ) : null}
      {places.map((place, index) => (
        <li
          key={place.id}
          id={`${id}-opt-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          aria-label={[place.name, place.admin1, place.country].filter(Boolean).join(", ")}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onChoose(place)}
          onMouseEnter={() => onHover(index)}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
            index === activeIndex ? "bg-brand-50 text-ink" : "text-ink-2",
          )}
        >
          <Icon aria-hidden="true" className="text-ink-3 size-4 shrink-0" />
          <span>
            <span className="text-ink font-medium">{place.name}</span>
            <span className="text-ink-3 block text-xs">{regionAndCountry(place)}</span>
          </span>
        </li>
      ))}
      {status === "done" && places.length === 0 ? (
        <li role="presentation" className="text-ink-3 px-3 py-3 text-sm">
          No matching locations. Check the spelling or try a nearby larger city.
        </li>
      ) : null}
      {status === "error" ? (
        <li role="presentation" className="text-danger-700 px-3 py-3 text-sm">
          Search is unavailable. Check your connection and try again.
        </li>
      ) : null}
    </ul>
  );
}
