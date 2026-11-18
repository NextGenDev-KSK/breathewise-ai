"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/types/air";
import { GeocodingError, sanitizeQuery, searchPlaces } from "@/lib/air/geocoding";

const DEBOUNCE_MS = 300;

export type SearchStatus = "idle" | "searching" | "done" | "error";

interface SearchResult {
  query: string;
  status: "done" | "error";
  results: Place[];
}

export interface CitySearch {
  /** The cleaned query, or null when too short to search. */
  query: string | null;
  status: SearchStatus;
  results: Place[];
}

/**
 * Debounced city search. Each new query cancels the previous request, and results are only
 * ever shown for the query that produced them (never for an older one).
 */
export function useCitySearch(input: string): CitySearch {
  const query = sanitizeQuery(input);
  const [latest, setLatest] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(query, { signal: controller.signal })
        .then((results) => setLatest({ query, status: "done", results }))
        .catch((error: unknown) => {
          if (error instanceof GeocodingError && error.kind === "aborted") return;
          setLatest({ query, status: "error", results: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (!query) return { query: null, status: "idle", results: [] };
  if (latest?.query !== query) return { query, status: "searching", results: [] };
  return { query, status: latest.status, results: latest.results };
}

/** Text announced to screen readers for the current search state. */
export function searchStatusText(search: CitySearch): string {
  if (search.status === "searching") return "Searching…";
  if (search.status === "error") return "Location search is unavailable right now.";
  if (search.status === "done") {
    const count = search.results.length;
    return count
      ? `${count} location${count === 1 ? "" : "s"} found. Use up and down arrows to choose.`
      : "No matching locations found.";
  }
  return "";
}
