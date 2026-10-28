/** Pages that can be opened without logging in. Everything else needs a login. */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/callback", "/auth/signout"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Where to go after logging in. Only same-site paths are allowed, so a crafted
 * link like /login?next=https://evil.example cannot send people elsewhere.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/\\") || isPublicPath(next.split("?")[0])) return "/";
  return next;
}
