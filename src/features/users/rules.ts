import type { Role } from "@/features/auth/permissions";
import type { MessageKey } from "@/i18n";

/**
 * Owners cannot turn off or change the role of their own login, so the app can never be left
 * without an active owner (the person doing the change is always an active owner).
 */
export function selfChangeProblem(change: {
  actorId: string;
  targetId: string;
  currentRole: Role;
  newRole?: Role;
  deactivate?: boolean;
}): MessageKey | null {
  if (change.actorId !== change.targetId) return null;
  if (change.deactivate) return "users.cannotChangeSelf";
  if (change.newRole && change.newRole !== change.currentRole) return "users.cannotChangeSelf";
  return null;
}

/** First free username like ramesh2, ramesh3… */
export function suggestUsername(base: string, taken: ReadonlySet<string>): string {
  const stem = base.replace(/\d+$/, "") || base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem}${n}`.slice(0, 30);
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem.slice(0, 20)}${Date.now() % 100000}`;
}
