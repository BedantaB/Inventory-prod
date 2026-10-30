import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";

export type UserRow = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
};

const columns = {
  id: profiles.id,
  username: profiles.username,
  fullName: profiles.fullName,
  role: profiles.role,
  isActive: profiles.isActive,
};

/** Everyone with a login in this shop; active first, owners first, then by name. */
export async function listUsers(shopId: string, query?: string): Promise<UserRow[]> {
  const q = query?.trim();
  const pattern = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  return getDb()
    .select(columns)
    .from(profiles)
    .where(
      and(
        eq(profiles.shopId, shopId),
        pattern
          ? or(ilike(profiles.fullName, pattern), ilike(profiles.username, pattern))
          : undefined,
      ),
    )
    .orderBy(desc(profiles.isActive), asc(profiles.role), asc(profiles.fullName));
}

export async function getUserById(shopId: string, id: string): Promise<UserRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [user] = await getDb()
    .select(columns)
    .from(profiles)
    .where(and(eq(profiles.shopId, shopId), eq(profiles.id, id)));
  return user ?? null;
}

/** Usernames starting with `stem`, to suggest a free one. Usernames are unique across ALL shops. */
export async function usernamesLike(stem: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ username: profiles.username })
    .from(profiles)
    .where(
      sql`lower(${profiles.username}) like ${stem.replace(/\d+$/, "").replace(/[%_\\]/g, "\\$&") + "%"}`,
    );
  return new Set(rows.map((r) => r.username.toLowerCase()));
}
