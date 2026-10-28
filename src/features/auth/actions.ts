"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { serverEnv } from "@/lib/env.server";
import { failure, parseForm, success, type ActionResult } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginEmail } from "@/features/users/login-identity";
import { safeNextPath } from "./paths";
import { forgotPasswordSchema, loginSchema, newPasswordSchema } from "./schemas";
import { requireUser } from "./session";

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { identifier, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail(identifier, serverEnv().STAFF_EMAIL_DOMAIN),
    password,
  });

  if (error) {
    if (error.code === "invalid_credentials") return failure("auth.wrongPassword");
    if (error.code === "user_banned") return failure("auth.accountInactive");
    console.error("Login failed", error);
    return failure("auth.loginFailed");
  }

  const [profile] = await getDb()
    .select({ isActive: profiles.isActive })
    .from(profiles)
    .where(eq(profiles.id, data.user.id));
  if (!profile?.isActive) {
    await supabase.auth.signOut();
    return failure("auth.accountInactive");
  }

  redirect(safeNextPath(next));
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login?reason=logged-out");
}

/**
 * Sends the Supabase reset email. Always reports success so nobody can use this
 * form to find out which emails have a login.
 */
export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.ok) return parsed.result;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${serverEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });
  if (error) console.error("Password reset email failed", error);
  return success("auth.resetLinkSent");
}

/** Sets a new password for the logged-in user (after opening the reset link). */
export async function updateOwnPassword(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parseForm(newPasswordSchema, formData);
  if (!parsed.ok) return parsed.result;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return success("auth.passwordSaved");
    console.error("Password update failed", error);
    return failure("errors.generic");
  }
  return success("auth.passwordSaved");
}
