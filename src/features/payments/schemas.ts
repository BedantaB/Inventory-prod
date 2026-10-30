import { z } from "zod";
import { rupeesToPaise } from "@/lib/money";

// Messages are i18n keys.

export const PAYMENT_METHODS = ["CASH", "UPI", "BANK", "CHEQUE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** ₹10 crore: far above any real payment, well inside safe numbers. */
export const MAX_PAYMENT_PAISE = 10_00_00_000_00;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .optional()
    .transform((v) => (v ? v : null));

const amount = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, { error: "payments.amountRequired" })
  .refine((v) => (rupeesToPaise(v) ?? 0) > 0, { error: "payments.invalidAmount" })
  .refine((v) => rupeesToPaise(v)! <= MAX_PAYMENT_PAISE, { error: "validation.tooLarge" })
  .transform((v) => rupeesToPaise(v)!);

const method = z.enum(PAYMENT_METHODS, { error: "payments.chooseMethod" });

/** "Record payment" on the customer page. The date is checked on the server (receivedAtFrom). */
export const paymentSchema = z.object({
  amount,
  method,
  receivedOn: z.string().trim().optional().default(""),
  reference: optionalText(60),
  note: optionalText(300),
});

export const voidPaymentSchema = z.object({
  reason: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "payments.voidReasonRequired" })
    .max(300, { error: "validation.tooLong" }),
});

/** "Paid now" at checkout: empty amount = nothing paid yet. */
export const paidNowSchema = z
  .object({
    paidNow: z.string().trim().optional().default(""),
    paidMethod: z.string().optional().default(""),
  })
  .transform((v, ctx) => {
    if (v.paidNow === "") return null;
    const paise = rupeesToPaise(v.paidNow);
    if (paise === null || paise <= 0) {
      ctx.addIssue({ code: "custom", path: ["paidNow"], message: "payments.invalidAmount" });
      return z.NEVER;
    }
    const parsed = method.safeParse(v.paidMethod);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", path: ["paidMethod"], message: "payments.chooseMethod" });
      return z.NEVER;
    }
    return { amountPaise: paise, method: parsed.data };
  });
