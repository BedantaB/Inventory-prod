import { describe, expect, it } from "vitest";
import { zodFieldErrors } from "@/lib/forms";
import { forgotPasswordSchema, loginSchema, newPasswordSchema } from "./schemas";

function errorsOf(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
  value: unknown,
) {
  const result = schema.safeParse(value);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.success ? {} : zodFieldErrors(result.error as any);
}

describe("auth schemas", () => {
  it("requires both login fields", () => {
    expect(errorsOf(loginSchema, { identifier: "  ", password: "" })).toEqual({
      identifier: { key: "validation.required" },
      password: { key: "validation.required" },
    });
  });

  it("treats a missing field as required, not a type error", () => {
    expect(errorsOf(loginSchema, {})).toMatchObject({ identifier: { key: "validation.required" } });
  });

  it("checks the email format", () => {
    expect(errorsOf(forgotPasswordSchema, { email: "owner@" })).toEqual({
      email: { key: "validation.email" },
    });
    expect(errorsOf(forgotPasswordSchema, { email: "" })).toEqual({
      email: { key: "validation.required" },
    });
  });

  it("checks new passwords are long enough and match", () => {
    expect(errorsOf(newPasswordSchema, { password: "short", confirmPassword: "short" })).toEqual({
      password: { key: "validation.passwordTooShort" },
    });
    expect(
      errorsOf(newPasswordSchema, { password: "long-enough", confirmPassword: "different" }),
    ).toEqual({ confirmPassword: { key: "validation.passwordsDontMatch" } });
  });
});
