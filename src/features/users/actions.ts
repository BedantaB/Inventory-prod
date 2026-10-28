"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { DB_ERROR, getPgErrorCode } from "@/db/errors";
import { profiles } from "@/db/schema";
import { can } from "@/features/auth/permissions";
import { requireUser, type CurrentUser } from "@/features/auth/session";
import { serverEnv } from "@/lib/env.server";
import { failure, fieldFailure, parseForm, success, type ActionResult } from "@/lib/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { staffEmail } from "./login-identity";
import { getUserById, usernamesLike } from "./queries";
import { selfChangeProblem, suggestUsername } from "./rules";
import { createUserSchema, resetUserPasswordSchema, updateUserSchema } from "./schemas";

/** ~100 years: Supabase's way of turning a login off. "none" turns it back on. */
const BAN_FOREVER = "876000h";

async function requireManager(): Promise<CurrentUser | null> {
  const actor = await requireUser();
  return can(actor, "manageUsers") ? actor : null;
}

async function usernameTaken(username: string): Promise<ActionResult<never>> {
  const suggestion = suggestUsername(username, await usernamesLike(username));
  return fieldFailure("username", "users.usernameTaken", { suggestion });
}

export async function createStaffUser(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const parsed = parseForm(createUserSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { fullName, username, role, password } = parsed.data;

  const taken = await usernamesLike(username);
  if (taken.has(username)) return usernameTaken(username);

  const email = staffEmail(username, serverEnv().STAFF_EMAIL_DOMAIN);
  const admin = createSupabaseAdminClient().auth.admin;
  const { data, error } = await admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    if (error.code === "email_exists") return usernameTaken(username);
    if (error.code === "weak_password")
      return fieldFailure("password", "validation.passwordTooShort");
    console.error("Create login failed", error);
    return failure("errors.generic");
  }

  try {
    await getDb()
      .insert(profiles)
      .values({ id: data.user.id, username, fullName, email, role, createdBy: actor.id });
  } catch (dbError) {
    // Keep Supabase Auth and our profiles in step: remove the half-created login.
    await admin.deleteUser(data.user.id);
    if (getPgErrorCode(dbError) === DB_ERROR.uniqueViolation) return usernameTaken(username);
    throw dbError;
  }

  revalidatePath("/users");
  return success("users.created", { name: fullName }, { id: data.user.id });
}

export async function updateStaffUser(userId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const target = await getUserById(userId);
  if (!target) return failure("errors.notFound");
  const parsed = parseForm(updateUserSchema, formData);
  if (!parsed.ok) return parsed.result;

  const problem = selfChangeProblem({
    actorId: actor.id,
    targetId: target.id,
    currentRole: target.role,
    newRole: parsed.data.role,
  });
  if (problem) return failure(problem);

  await getDb()
    .update(profiles)
    .set({ fullName: parsed.data.fullName, role: parsed.data.role })
    .where(eq(profiles.id, target.id));

  revalidatePath("/users");
  revalidatePath(`/users/${target.id}`);
  return success("users.updated");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const target = await getUserById(userId);
  if (!target) return failure("errors.notFound");

  const problem = selfChangeProblem({
    actorId: actor.id,
    targetId: target.id,
    currentRole: target.role,
    deactivate: !active,
  });
  if (problem) return failure(problem);

  // Ban in Supabase first (stops new logins and token refresh), then flip our flag
  // (which every page checks, so open sessions stop working right away).
  const admin = createSupabaseAdminClient().auth.admin;
  const { error } = await admin.updateUserById(target.id, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (error) {
    console.error("Changing login status failed", error);
    return failure("errors.generic");
  }
  await getDb().update(profiles).set({ isActive: active }).where(eq(profiles.id, target.id));

  revalidatePath("/users");
  revalidatePath(`/users/${target.id}`);
  return success(active ? "users.reactivated" : "users.deactivated", { name: target.fullName });
}

export async function resetUserPassword(userId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const target = await getUserById(userId);
  if (!target) return failure("errors.notFound");
  const parsed = parseForm(resetUserPasswordSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(target.id, {
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "weak_password")
      return fieldFailure("password", "validation.passwordTooShort");
    console.error("Password reset failed", error);
    return failure("errors.generic");
  }
  return success("users.passwordReset", { name: target.fullName });
}
