import { BUSINESS_TIME_ZONE } from "./financial-year";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "28 Oct 2026" in Indian time. */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** "28 Oct 2026, 4:05 pm" in Indian time. */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-28" (from a date box) → that day's start in Indian time, or null if not a real date. */
export function istDayStart(value: string | undefined): Date | null {
  if (!value) return null;
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject dates that don't exist (31 Feb would otherwise roll over into March).
  const [, y, m, d] = match.map(Number);
  const back = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return back.getUTCFullYear() === y && back.getUTCMonth() + 1 === m && back.getUTCDate() === d
    ? date
    : null;
}

/** Start of the day after (for "to" dates, which include the whole day). */
export function nextDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}
