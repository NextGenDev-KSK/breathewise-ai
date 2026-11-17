"use client";

import { useCallback, useState } from "react";
import { placeFromCoordinates } from "@/lib/air/geocoding";
import { useApp } from "@/components/app/AppProvider";
import { useToast } from "@/components/ui/Toast";

/**
 * Requests the browser location only when the user explicitly asks.
 * Coordinates are rounded to ~1 km before use and never leave the browser except
 * as the latitude/longitude of the Open-Meteo request.
 */
export function useDetectLocation() {
  const { selectPlace } = useApp();
  const toast = useToast();
  const [locating, setLocating] = useState(false);

  const detect = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast("Your browser does not support location detection. Please search for your city.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        selectPlace(placeFromCoordinates(pos.coords.latitude, pos.coords.longitude));
        toast("Showing air quality for your approximate location.", "success");
      },
      (err) => {
        setLocating(false);
        toast(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was not granted. You can search for your city instead."
            : "Your location could not be determined. Please search for your city.",
          "error",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  }, [selectPlace, toast]);

  return { detect, locating };
}
