import { istDateString, istDayStart } from "@/lib/dates";

/**
 * When a payment was received, from the date box: today (or empty) → right now; an earlier day
 * → midday that day (Indian time); a future or impossible date → a problem to show.
 */
export function receivedAtFrom(dateText: string, now: Date): Date | "future" | "invalid" {
  if (dateText === "" || dateText === istDateString(now)) return now;
  const dayStart = istDayStart(dateText);
  if (!dayStart) return "invalid";
  if (dayStart > now) return "future";
  return new Date(dayStart.getTime() + 12 * 60 * 60 * 1000);
}
