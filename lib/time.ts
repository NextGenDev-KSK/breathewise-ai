/**
 * Open-Meteo returns local wall-clock times without an offset ("2026-11-17T06:00")
 * together with `utc_offset_seconds`. These helpers keep everything in the
 * location's local time, independent of the browser's own time zone.
 */

const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Formats a location-local wall-clock string ("2026-11-17T06:00") for display. */
export type FormatTime = (localTime: string) => string;

/** True for a location-local wall-clock string such as "2026-11-17T06:00". */
export function isLocalTimeString(value: string): boolean {
  return LOCAL_TIME.test(value);
}

/** Converts a location-local wall-clock string to an absolute epoch (ms). */
export function localTimeToEpoch(localTime: string, utcOffsetSeconds: number): number {
  const m = LOCAL_TIME.exec(localTime);
  if (!m) throw new Error(`Invalid local time: ${localTime}`);
  const [, y, mo, d, h, mi] = m;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return asUtc - utcOffsetSeconds * 1000;
}

/** Formats an absolute instant as a location-local wall-clock string. */
export function epochToLocalTime(epochMs: number, utcOffsetSeconds: number): string {
  const d = new Date(epochMs + utcOffsetSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Local hour (0–23) of a wall-clock string. */
export function localHour(localTime: string): number {
  return Number(localTime.slice(11, 13));
}

function localDate(localTime: string): string {
  return localTime.slice(0, 10);
}

export type TimeFormat = "24h" | "12h";

/** Default display format used by the engine when the caller does not pass one. */
export const formatTime24: FormatTime = (localTime) => formatClock(localTime, "24h");

/** "06:00" or "6 AM" from a wall-clock string. */
export function formatClock(localTime: string, format: TimeFormat = "24h"): string {
  const hh = Number(localTime.slice(11, 13));
  const mm = localTime.slice(14, 16);
  if (format === "24h") return `${String(hh).padStart(2, "0")}:${mm}`;
  const suffix = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm === "00" ? `${h12} ${suffix}` : `${h12}:${mm} ${suffix}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short weekday name ("Tue") for an ISO calendar date ("2026-11-17"). */
export function weekdayShort(isoDate: string): string {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()] ?? "";
}

/** "Tue 17 Nov" from a wall-clock string (calendar arithmetic only). */
export function formatDay(localTime: string): string {
  const [y, m, d] = localDate(localTime).split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
}

/** "Today", "Tomorrow" or a formatted day, relative to the location's current date. */
export function relativeDayLabel(localTime: string, nowLocal: string): string {
  const day = localDate(localTime);
  const today = localDate(nowLocal);
  if (day === today) return "Today";
  const t = Date.parse(`${today}T00:00:00Z`) + DAY_MS;
  if (day === new Date(t).toISOString().slice(0, 10)) return "Tomorrow";
  return formatDay(localTime);
}

/** Human description of data age, e.g. "12 min ago". */
export function formatAge(fromMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - fromMs) / MINUTE_MS));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Converts "HH:MM" to minutes since midnight. */
export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number) as [number, number];
  return h * 60 + m;
}
