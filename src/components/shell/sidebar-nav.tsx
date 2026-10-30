"use client";

import { LogOutIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/features/auth/actions";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { isActive, visibleItems } from "./nav-items";

export type ShellUser = { fullName: string; isAdmin: boolean; shopName: string } | null;

/** Desktop left sidebar. `user` is null while the login is still loading. */
export function SidebarNav({ user }: { user: ShellUser }) {
  const m = useMessages();
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <Link href="/" className="mb-4 flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <PackageIcon className="size-6" aria-hidden />
        </span>
        <span className="line-clamp-2 text-xl font-bold">{user?.shopName || m.app.name}</span>
      </Link>

      <nav aria-label={m.nav.mainNavigation} className="flex flex-1 flex-col gap-1">
        {visibleItems(user?.isAdmin ?? false).map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium text-sidebar-foreground hover:bg-sidebar-accent",
                active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden />
              {m.nav[item.label]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-3">
        {user && (
          <p className="truncate px-3 pb-2 text-sm text-muted-foreground">
            {format(m.nav.loggedInAs, { name: user.fullName })}
          </p>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-base font-medium hover:bg-sidebar-accent"
          >
            <LogOutIcon className="size-5" aria-hidden />
            {m.nav.logout}
          </button>
        </form>
      </div>
    </div>
  );
}
