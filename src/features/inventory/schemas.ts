import { z } from "zod";
import { rupeesToPaise } from "@/lib/money";
import { parseQty } from "@/lib/qty";
import { MAX_PRICE_PAISE } from "@/features/items/schemas";

// Messages are i18n keys. The lines arrive as JSON in one hidden field ("lines"), and each line's
// inputs also carry names like "lines.0.quantity" so errors can show next to the right box.

export const MAX_STOCK_LINES = 100;

export const stockLineSchema = z.object({
  itemId: z.uuid({ error: "stock.chooseItem" }),
  quantity: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .refine((v) => (parseQty(v, { allowDecimal: true }) ?? 0) > 0, {
      error: "stock.invalidQuantity",
    })
    .transform((v) => parseQty(v, { allowDecimal: true })!),
  unitCost: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "stock.costRequired" })
    .refine((v) => rupeesToPaise(v) !== null, { error: "items.invalidPrice" })
    .refine((v) => rupeesToPaise(v)! <= MAX_PRICE_PAISE, { error: "validation.tooLarge" })
    .transform((v) => rupeesToPaise(v)!),
});

export const stockEntrySchema = z.object({
  reference: z
    .string()
    .trim()
    .max(60, { error: "validation.tooLong" })
    .optional()
    .transform((v) => (v ? v : null)),
  note: z
    .string()
    .trim()
    .max(500, { error: "validation.tooLong" })
    .optional()
    .transform((v) => (v ? v : null)),
  lines: z
    .string({ error: "stock.noLines" })
    .transform((v): unknown => {
      try {
        return JSON.parse(v);
      } catch {
        return [];
      }
    })
    .pipe(
      z
        .array(stockLineSchema)
        .min(1, { error: "stock.noLines" })
        .max(MAX_STOCK_LINES, { error: "stock.tooManyLines" }),
    ),
});

export type StockEntryInput = z.infer<typeof stockEntrySchema>;
