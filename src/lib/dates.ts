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
