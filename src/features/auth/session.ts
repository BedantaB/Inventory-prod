import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { profiles, shops } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "./permissions";

/** A shop user (owner or staff). Everything they see and change belongs to `shopId`. */
export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  shopId: string;
  shopName: string;
};

/** The platform admin: creates and manages shops, never sees shop data. */
export type PlatformAdmin = {
  id: string;
  username: string;
  fullName: string;
  email: string;
};

type SessionState =
  | { status: "signed-out" }
  | { status: "inactive" }
  | { status: "active"; user: CurrentUser }
  | { status: "platform"; admin: PlatformAdmin };

/**
 * Reads the login from the cookie and loads the profile and shop. Runs once per request
 * (React cache). Read from the database every time, so turning a login or a whole shop off
 * works immediately.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  // The session is per-request (and Supabase checks token expiry with the clock), so never prerender it.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { status: "signed-out" };

  const [row] = await getDb()
    .select({
      id: profiles.id,
      username: profiles.username,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      isActive: profiles.isActive,
      isPlatformAdmin: profiles.isPlatformAdmin,
      shopId: profiles.shopId,
      shopName: shops.name,
      shopActive: shops.isActive,
    })
    .from(profiles)
    .leftJoin(shops, eq(profiles.shopId, shops.id))
    .where(eq(profiles.id, userId));

  if (!row || !row.isActive) return { status: "inactive" };
  const base = { id: row.id, username: row.username, fullName: row.fullName, email: row.email };
  if (row.isPlatformAdmin) return { status: "platform", admin: base };
  if (!row.shopId || !row.shopActive) return { status: "inactive" };
  return {
    status: "active",
    user: { ...base, role: row.role, shopId: row.shopId, shopName: row.shopName ?? "" },
  };
});

/**
 * For shop pages and server actions: the logged-in, active shop user — or off to the login page.
 * The platform admin is sent to the platform pages (it has no shop data to see).
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  if (session.status === "inactive") redirect("/auth/signout?reason=inactive");
  if (session.status === "platform") redirect("/platform");
  return session.user;
}

/** Any signed-in, active login (shop user or platform admin), e.g. to change one's own password. */
export async function requireSignedIn(): Promise<{ id: string }> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  if (session.status === "inactive") redirect("/auth/signout?reason=inactive");
  return session.status === "platform" ? session.admin : session.user;
}

/** For owner-only pages: staff are sent home with a short explanation. */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/?denied=1");
  return user;
}

/** For the platform pages and actions. Shop users are sent to their shop's home page. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  if (session.status === "inactive") redirect("/auth/signout?reason=inactive");
  if (session.status === "active") redirect("/");
  return session.admin;
}
