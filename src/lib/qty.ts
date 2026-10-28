/**
 * Quantities have up to 3 decimals (2.5 kg). In TypeScript they are handled as whole
 * "milli-units" (2.5 → 2500) so there is no floating-point drift. The database stores
 * numeric(12,3), which Drizzle returns as a string: convert with qtyFromDb / qtyToDb.
 */

export const QTY_SCALE = 1000;
/** numeric(12,3) holds at most 999,999,999.999 */
export const MAX_QTY_MILLI = 999_999_999_999;

const DB_PATTERN = /^(-)?(\d+)(?:\.(\d{1,3}))?$/;

/**
 * Parses what a person typed ("2.5", "1,000") into milli-units.
 * Decimals are only accepted when the item's unit allows them (kg, litre).
 */
export function parseQty(input: string, opts: { allowDecimal: boolean }): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  const pattern = opts.allowDecimal ? /^\d+(\.\d{1,3})?$/ : /^\d+$/;
  if (!pattern.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const milli = Number(whole) * QTY_SCALE + Number(fraction.padEnd(3, "0"));
  return Number.isSafeInteger(milli) && milli <= MAX_QTY_MILLI ? milli : null;
}

/** "2.500" → 2500, "-3.000" → -3000 */
export function qtyFromDb(value: string): number {
  const match = DB_PATTERN.exec(value.trim());
  if (!match) throw new Error(`Invalid quantity from database: ${value}`);
  const [, minus, whole, fraction = ""] = match;
  const milli = Number(whole) * QTY_SCALE + Number(fraction.padEnd(3, "0"));
  return minus ? -milli : milli;
}

/** 2500 → "2.500" */
export function qtyToDb(milli: number): string {
  if (!Number.isSafeInteger(milli))
    throw new RangeError(`Quantity must be whole milli-units: ${milli}`);
  const sign = milli < 0 ? "-" : "";
  const abs = Math.abs(milli);
  return `${sign}${Math.trunc(abs / QTY_SCALE)}.${String(abs % QTY_SCALE).padStart(3, "0")}`;
}

const qtyFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

/** 1250000 → "1,250", 2500 → "2.5" */
export function formatQty(milli: number): string {
  return qtyFormatter.format(milli / QTY_SCALE);
}

/** quantity × unit price, rounded half-up to whole paise. Exact for any size (BigInt). */
export function lineTotalPaise(qtyMilli: number, unitPricePaise: number): number {
  if (qtyMilli < 0 || unitPricePaise < 0)
    throw new RangeError("lineTotalPaise expects non-negative values");
  const product = BigInt(qtyMilli) * BigInt(unitPricePaise);
  const rounded = (product + BigInt(QTY_SCALE / 2)) / BigInt(QTY_SCALE);
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError("Line total is too large");
  return result;
}
