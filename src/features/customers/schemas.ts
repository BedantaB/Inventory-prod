import { z } from "zod";
import { normalizeIndianPhone } from "@/lib/phone";

// "Customers" in the app = the vendors table (see CLAUDE.md). Messages are i18n keys.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .optional()
    .transform((v) => (v ? v : null));

export const customerSchema = z.object({
  businessName: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .max(120, { error: "validation.tooLong" }),
  contactPerson: optionalText(80),
  phone: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .refine((v) => normalizeIndianPhone(v) !== null, { error: "customers.invalidPhone" })
    .transform((v) => normalizeIndianPhone(v)!),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.email().safeParse(v).success, { error: "validation.email" }),
  address: optionalText(300),
  city: optionalText(60),
  notes: optionalText(1000),
});

export type CustomerInput = z.infer<typeof customerSchema>;
