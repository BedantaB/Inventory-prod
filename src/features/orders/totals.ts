import { lineTotalPaise } from "@/lib/qty";

/**
 * Order money maths, shared by the cart screen (live totals) and checkout (the real numbers).
 * The server always recalculates from the database at checkout.
 */

export type DiscountKind = "AMOUNT" | "PERCENT";

/** AMOUNT: value in paise (never more than the subtotal). PERCENT: value in basis points (10% = 1000). */
export function discountPaise(subtotalPaise: number, kind: DiscountKind, value: number): number {
  if (value <= 0 || subtotalPaise <= 0) return 0;
  if (kind === "AMOUNT") return Math.min(value, subtotalPaise);
  const bp = Math.min(value, 10_000);
  // Round half up, exactly.
  return Number((BigInt(subtotalPaise) * BigInt(bp) + BigInt(5_000)) / BigInt(10_000));
}

export function orderTotals(
  lines: { qtyMilli: number; unitPricePaise: number | null }[],
  discount: { kind: DiscountKind; value: number },
) {
  const subtotal = lines.reduce(
    (sum, l) =>
      sum + (l.unitPricePaise === null ? 0 : lineTotalPaise(l.qtyMilli, l.unitPricePaise)),
    0,
  );
  const discountAmount = discountPaise(subtotal, discount.kind, discount.value);
  return {
    subtotal,
    discount: discountAmount,
    total: subtotal - discountAmount,
    missingPrices: lines.filter((l) => l.unitPricePaise === null).length,
  };
}

/** "12.5" (percent typed by a person) → 1250 basis points; null if not 0–100 with ≤ 2 decimals. */
export function parsePercent(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const bp = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return bp <= 10_000 ? bp : null;
}

/** 1250 → "12.5" */
export function percentToInput(bp: number): string {
  return (bp / 100).toString();
}
