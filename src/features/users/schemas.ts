import { z } from "zod";
import { passwordSchema } from "@/features/auth/schemas";
import { USERNAME_PATTERN } from "./login-identity";

const fullName = z
  .string({ error: "validation.required" })
  .trim()
  .min(1, { error: "validation.required" })
  .max(80, { error: "validation.tooLong" });

const role = z.enum(["ADMIN", "STAFF"], { error: "validation.invalidChoice" });

export const createUserSchema = z.object({
  fullName,
  username: z
    .string({ error: "validation.required" })
    .trim()
    .toLowerCase()
    .min(1, { error: "validation.required" })
    .regex(USERNAME_PATTERN, { error: "validation.usernameFormat" }),
  role,
  password: passwordSchema,
});

export const updateUserSchema = z.object({ fullName, role });

export const resetUserPasswordSchema = z.object({ password: passwordSchema });
