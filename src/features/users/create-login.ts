import "server-only";
import { getDb } from "@/db";
import { DB_ERROR, getPgErrorCode } from "@/db/errors";
import { profiles } from "@/db/schema";
import { serverEnv } from "@/lib/env.server";
import { failure, fieldFailure, type ActionResult } from "@/lib/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { staffEmail } from "./login-identity";
import { usernamesLike } from "./queries";
import { suggestUsername } from "./rules";

export async function usernameTaken(username: string): Promise<ActionResult<never>> {
  const suggestion = suggestUsername(username, await usernamesLike(username));
  return fieldFailure("username", "users.usernameTaken", { suggestion });
}

/**
 * Creates a username login in a shop: the Supabase Auth user plus our profile. Used by owners
 * (staff logins) and by the platform admin (a new shop's owner). Usernames are unique across
 * all shops. Callers must have checked permissions already.
 */
export async function createShopLogin(input: {
  shopId: string;
  fullName: string;
  username: string;
  role: "ADMIN" | "STAFF";
  password: string;
  createdBy: string;
}): Promise<ActionResult<{ id: string }>> {
  const taken = await usernamesLike(input.username);
  if (taken.has(input.username)) return usernameTaken(input.username);

  const email = staffEmail(input.username, serverEnv().STAFF_EMAIL_DOMAIN);
  const admin = createSupabaseAdminClient().auth.admin;
  const { data, error } = await admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error) {
    if (error.code === "email_exists") return usernameTaken(input.username);
    if (error.code === "weak_password")
      return fieldFailure("password", "validation.passwordTooShort");
    console.error("Create login failed", error);
    return failure("errors.generic");
  }

  try {
    await getDb().insert(profiles).values({
      id: data.user.id,
      shopId: input.shopId,
      username: input.username,
      fullName: input.fullName,
      email,
      role: input.role,
      createdBy: input.createdBy,
    });
  } catch (dbError) {
    // Keep Supabase Auth and our profiles in step: remove the half-created login.
    await admin.deleteUser(data.user.id);
    if (getPgErrorCode(dbError) === DB_ERROR.uniqueViolation) return usernameTaken(input.username);
    throw dbError;
  }
  return { ok: true, data: { id: data.user.id } };
}
