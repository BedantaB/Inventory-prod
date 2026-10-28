/** All business dates (today's sales, order numbers) use Indian Standard Time. */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const yearMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
});

/** Indian financial year (1 April – 31 March) for a moment in time: "2026-27". */
export function financialYear(date: Date): string {
  const parts = yearMonthFormatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** ("2026-27", 1) → "ORD-2026-27-00001" */
export function formatOrderNumber(fy: string, sequence: number): string {
  return `ORD-${fy}-${String(sequence).padStart(5, "0")}`;
}
