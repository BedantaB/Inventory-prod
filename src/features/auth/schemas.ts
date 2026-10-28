import { z } from "zod";

// Error messages are i18n keys (src/i18n/en.ts); the UI translates them.

export const loginSchema = z.object({
  identifier: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" }),
  password: z.string({ error: "validation.required" }).min(1, { error: "validation.required" }),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required" })
    .pipe(z.email({ error: "validation.email" })),
});

export const passwordSchema = z
  .string({ error: "validation.required" })
  .min(8, { error: "validation.passwordTooShort" })
  .max(72, { error: "validation.tooLong" });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z
      .string({ error: "validation.required" })
      .min(1, { error: "validation.required" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "validation.passwordsDontMatch",
    path: ["confirmPassword"],
  });
