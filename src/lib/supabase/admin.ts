import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";

/**
 * Supabase client with the SECRET key: can create users, reset passwords and ban logins.
 * Server only. Use it only after checking the caller is an active admin.
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
