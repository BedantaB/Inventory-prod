import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Signs out and returns to the login page. Pages send turned-off users here
 * (they cannot clear cookies themselves while rendering).
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const reason =
    request.nextUrl.searchParams.get("reason") === "inactive" ? "inactive" : "logged-out";
  return NextResponse.redirect(new URL(`/login?reason=${reason}`, request.nextUrl.origin));
}
