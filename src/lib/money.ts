/**
 * Money is always stored and calculated as whole paise (₹1 = 100 paise).
 * Display with formatINR() — never format money anywhere else.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 12345600 → "₹1,23,456.00" (Indian digit grouping). */
export function formatINR(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`formatINR expects whole paise, got ${paise}`);
  }
  return inrFormatter.format(paise / 100);
}

const RUPEES_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Parses what a person typed ("1,234.5", "₹ 99") into paise.
 * Returns null for anything that is not a non-negative amount with at most 2 decimals.
 */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!RUPEES_PATTERN.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Paise → plain text for an input box: 123450 → "1234.50", 100000 → "1000". */
export function paiseToInput(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const whole = Math.trunc(abs / 100);
  const fraction = abs % 100;
  return fraction === 0
    ? `${sign}${whole}`
    : `${sign}${whole}.${String(fraction).padStart(2, "0")}`;
}
