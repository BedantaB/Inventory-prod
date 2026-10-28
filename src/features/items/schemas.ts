import { z } from "zod";
import { rupeesToPaise } from "@/lib/money";
import { parseQty } from "@/lib/qty";

// Messages are i18n keys. Form values arrive as strings.

/** Highest price accepted: ₹1 crore. */
export const MAX_PRICE_PAISE = 1_00_00_000_00;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .optional()
    .transform((v) => (v ? v : null));

export const priceField = z
  .string()
  .trim()
  .optional()
  .transform((v) => v ?? "")
  .refine((v) => v === "" || rupeesToPaise(v) !== null, { error: "items.invalidPrice" })
  .refine((v) => v === "" || rupeesToPaise(v)! <= MAX_PRICE_PAISE, { error: "validation.tooLarge" })
  .transform((v) => (v === "" ? null : rupeesToPaise(v)!));

/** Quantity typed by a person → milli-units. Whether decimals are OK depends on the unit (checked on the server). */
export const quantityField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : "0"))
  .refine((v) => parseQty(v, { allowDecimal: true }) !== null, { error: "items.invalidQuantity" })
  .transform((v) => parseQty(v, { allowDecimal: true })!);

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.uuid().safeParse(v).success, {
    error: "validation.invalidChoice",
  });

export const itemSchema = z
  .object({
    name: z
      .string({ error: "validation.required" })
      .trim()
      .min(1, { error: "validation.required" })
      .max(120, { error: "validation.tooLong" }),
    variant: optionalText(60),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => v ?? "")
      .refine((v) => v === "" || /^[A-Z0-9][A-Z0-9\-_/.]{0,39}$/.test(v), {
        error: "validation.skuFormat",
      }),
    categoryId: optionalId,
    brandId: optionalId,
    unitId: z.uuid({ error: "validation.required" }),
    packSize: optionalText(60),
    mrp: priceField,
    sellingPrice: priceField,
    lowStockThreshold: quantityField,
    removePhoto: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  })
  .refine((v) => v.sellingPrice === null || v.mrp === null || v.sellingPrice <= v.mrp, {
    error: "items.priceAboveMrp",
    path: ["sellingPrice"],
  });

export type ItemInput = z.infer<typeof itemSchema>;

/** For new categories and brands. */
export const categorySchema = z.object({
  name: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .max(60, { error: "validation.tooLong" }),
});

export const unitSchema = z.object({
  name: z
    .string({ error: "validation.required" })
    .trim()
    .toLowerCase()
    .min(1, { error: "validation.required" })
    .max(20, { error: "validation.tooLong" })
    .regex(/^[a-z][a-z0-9 .-]*$/, { error: "validation.unitNameFormat" }),
  label: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .max(40, { error: "validation.tooLong" }),
  allowsDecimal: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
