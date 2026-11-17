import type { AirQualitySnapshot } from "@/types/air";
import type { Preferences } from "@/types/preferences";
import type { AssistantContext } from "@/lib/ai/schema";
import { currentConcern, dominantPollutant, isIndianLocation, upcomingHours } from "@/lib/engine/analysis";
import { findOutdoorWindow } from "@/lib/engine/windows";
import { generateRecommendations } from "@/lib/engine/recommendations";
import { POLLUTANTS } from "@/lib/air/pollutants";

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/**
 * Builds the minimal, validated context sent to the assistant endpoint.
 * Coordinates are never included; only a place label and readings.
 */
export function buildAssistantContext(snapshot: AirQualitySnapshot, prefs: Preferences, nowMs: number): AssistantContext {
  const c = currentConcern(snapshot);
  const d = dominantPollutant(snapshot);
  const activity = prefs.outdoorActivity === "none" ? "walking" : prefs.outdoorActivity;
  const w = findOutdoorWindow(snapshot, { activity, household: prefs.household, nowMs });
  const p = snapshot.current.pollutants;
  return {
    place: {
      name: snapshot.place.name.slice(0, 120),
      country: snapshot.place.country.slice(0, 80),
    },
    dataOrigin: snapshot.origin,
    observedAt: snapshot.current.time,
    timezone: snapshot.timezone,
    model: {
      name: snapshot.model.name,
      spatialResolution: snapshot.model.spatialResolution,
      temporalResolution: snapshot.model.temporalResolution,
    },
    current: {
      pm2_5: r1(p.pm2_5),
      pm10: r1(p.pm10),
      nitrogen_dioxide: r1(p.nitrogen_dioxide),
      sulphur_dioxide: r1(p.sulphur_dioxide),
      carbon_monoxide: r1(p.carbon_monoxide),
      ozone: r1(p.ozone),
      us_aqi: snapshot.current.usAqi,
      european_aqi: snapshot.current.europeanAqi,
    },
    concern: c ? { level: c.level, value: Math.round(c.value * 10) / 10, label: c.label, basis: c.basis, standardLabel: c.standardLabel } : null,
    dominantPollutant: d ? POLLUTANTS[d.key].shortLabel : null,
    next24h: upcomingHours(snapshot, nowMs, 24)
      .slice(0, 25)
      .map((h) => ({ time: h.time, pm2_5: r1(h.pm2_5), us_aqi: h.us_aqi })),
    outdoorWindow:
      w.status === "ok" && w.best
        ? { activity: w.profile.label, start: w.best.startTime, end: w.best.endTime, verdict: w.verdict, levelLabel: w.best.levelLabel }
        : null,
    preferences: {
      commuteMode: prefs.commuteMode,
      outdoorActivity: prefs.outdoorActivity,
      children: prefs.household.children,
      olderAdults: prefs.household.olderAdults,
      respiratorySensitivity: prefs.household.respiratorySensitivity,
      airPurifier: prefs.equipment.airPurifier,
      kitchenExhaust: prefs.equipment.kitchenExhaust,
    },
    ruleRecommendations: generateRecommendations({ snapshot, preferences: prefs, nowMs })
      .slice(0, 8)
      .map((r) => ({ title: r.title.slice(0, 200), reason: r.reason.slice(0, 500) })),
    isIndia: isIndianLocation(snapshot),
  };
}
