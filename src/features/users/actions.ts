"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { can } from "@/features/auth/permissions";
import { requireUser, type CurrentUser } from "@/features/auth/session";
import { failure, fieldFailure, parseForm, success, type ActionResult } from "@/lib/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createShopLogin } from "./create-login";
import { getUserById } from "./queries";
import { selfChangeProblem } from "./rules";
import { createUserSchema, resetUserPasswordSchema, updateUserSchema } from "./schemas";

/** ~100 years: Supabase's way of turning a login off. "none" turns it back on. */
const BAN_FOREVER = "876000h";

async function requireManager(): Promise<CurrentUser | null> {
  const actor = await requireUser();
  return can(actor, "manageUsers") ? actor : null;
}

export async function createStaffUser(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const parsed = parseForm(createUserSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { fullName, username, role, password } = parsed.data;

  const result = await createShopLogin({
    shopId: actor.shopId,
    fullName,
    username,
    role,
    password,
    createdBy: actor.id,
  });
  if (!result.ok) return result;

  revalidatePath("/users");
  return success("users.created", { name: fullName }, result.data);
}

export async function updateStaffUser(userId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const target = await getUserById(actor.shopId, userId);
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
    .where(and(eq(profiles.shopId, actor.shopId), eq(profiles.id, target.id)));

  revalidatePath("/users");
  revalidatePath(`/users/${target.id}`);
  return success("users.updated");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const target = await getUserById(actor.shopId, userId);
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
  await getDb()
    .update(profiles)
    .set({ isActive: active })
    .where(and(eq(profiles.shopId, actor.shopId), eq(profiles.id, target.id)));

  revalidatePath("/users");
  revalidatePath(`/users/${target.id}`);
  return success(active ? "users.reactivated" : "users.deactivated", { name: target.fullName });
}

export async function resetUserPassword(userId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return failure("errors.adminOnly");
  const target = await getUserById(actor.shopId, userId);
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
