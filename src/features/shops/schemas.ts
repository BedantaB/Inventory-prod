import { z } from "zod";
import { createUserSchema } from "@/features/users/schemas";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .optional()
    .transform((v) => (v ? v : null));

/** Name, address and phone: shown on printed orders. Edited by the owner or the platform admin. */
export const shopDetailsSchema = z.object({
  name: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .max(80, { error: "validation.tooLong" }),
  address: optionalText(300),
  phone: optionalText(40),
});

export type ShopDetails = z.infer<typeof shopDetailsSchema>;

/** A new shop plus its owner's login (the owner logs in with the username). */
export const createShopSchema = shopDetailsSchema.extend({
  fullName: createUserSchema.shape.fullName,
  username: createUserSchema.shape.username,
  password: createUserSchema.shape.password,
});
