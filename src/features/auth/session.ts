import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "./permissions";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
};

type SessionState =
  { status: "signed-out" } | { status: "inactive" } | { status: "active"; user: CurrentUser };

/**
 * Reads the login from the cookie and loads the profile. Runs once per request (React cache).
 * The profile is read from the database every time, so turning a login off works immediately.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  // The session is per-request (and Supabase checks token expiry with the clock), so never prerender it.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { status: "signed-out" };

  const [profile] = await getDb()
    .select({
      id: profiles.id,
      username: profiles.username,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(eq(profiles.id, userId));

  if (!profile || !profile.isActive) return { status: "inactive" };
  return {
    status: "active",
    user: {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      email: profile.email,
      role: profile.role,
    },
  };
});

/** For pages and server actions: the logged-in, active user — or off to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  if (session.status === "inactive") redirect("/auth/signout?reason=inactive");
  return session.user;
}

/** For admin-only pages: staff are sent home with a short explanation. */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/?denied=1");
  return user;
}
