"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { can } from "@/features/auth/permissions";
import { requirePlatformAdmin, requireUser } from "@/features/auth/session";
import { createShopLogin, usernameTaken } from "@/features/users/create-login";
import { usernamesLike } from "@/features/users/queries";
import { resetUserPasswordSchema } from "@/features/users/schemas";
import { failure, fieldFailure, parseForm, success, type ActionResult } from "@/lib/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as data from "./data";
import { createShopSchema, shopDetailsSchema } from "./schemas";

const isUuid = (id: string) => z.uuid().safeParse(id).success;

// ---- Platform admin ----

/** Creates a shop, its units and its owner's login. */
export async function createShopAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const admin = await requirePlatformAdmin();
  const parsed = parseForm(createShopSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { name, address, phone, fullName, username, password } = parsed.data;

  // Check the username first, so a taken one doesn't leave an empty shop behind.
  if ((await usernamesLike(username)).has(username)) return usernameTaken(username);

  const db = getDb();
  const shop = await data.createShop(db, { name, address, phone }, admin.id);
  let login: ActionResult<{ id: string }> | undefined;
  try {
    login = await createShopLogin({
      shopId: shop.id,
      fullName,
      username,
      role: "ADMIN",
      password,
      createdBy: admin.id,
    });
  } finally {
    if (!login?.ok) await data.deleteNewShop(db, shop.id);
  }
  if (!login.ok) return login;

  revalidatePath("/platform");
  return success("shops.created", { name, username }, { id: shop.id });
}

export async function updateShopAction(shopId: string, formData: FormData): Promise<ActionResult> {
  await requirePlatformAdmin();
  if (!isUuid(shopId)) return failure("errors.notFound");
  const parsed = parseForm(shopDetailsSchema, formData);
  if (!parsed.ok) return parsed.result;
  const shop = await data.updateShopDetails(getDb(), shopId, parsed.data);
  if (!shop) return failure("errors.notFound");
  revalidatePath("/platform");
  revalidatePath(`/platform/shops/${shopId}`);
  return success("shops.updated");
}

export async function setShopActiveAction(shopId: string, active: boolean): Promise<ActionResult> {
  await requirePlatformAdmin();
  if (!isUuid(shopId)) return failure("errors.notFound");
  const shop = await data.setShopActive(getDb(), shopId, active);
  if (!shop) return failure("errors.notFound");
  revalidatePath("/platform");
  revalidatePath(`/platform/shops/${shopId}`);
  return success(active ? "shops.reactivated" : "shops.deactivated", { name: shop.name });
}

/** Sets a new password for a login of any shop (never the platform admin's own). */
export async function resetShopLoginPassword(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requirePlatformAdmin();
  if (!isUuid(userId)) return failure("errors.notFound");
  const [target] = await getDb()
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.id, userId), isNotNull(profiles.shopId)));
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

// ---- Shop owner ----

/** The owner edits their own shop's name, address and phone (Shop settings). */
export async function updateOwnShop(formData: FormData): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "manageShop")) return failure("errors.adminOnly");
  const parsed = parseForm(shopDetailsSchema, formData);
  if (!parsed.ok) return parsed.result;
  await data.updateShopDetails(getDb(), actor.shopId, parsed.data);
  revalidatePath("/", "layout");
  return success("shops.updated");
}
