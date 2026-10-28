import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Landing point for links in Supabase emails (password reset). Swaps the code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
    console.error("Auth callback failed", error);
  }
  return NextResponse.redirect(new URL("/forgot-password?error=link", origin));
}
