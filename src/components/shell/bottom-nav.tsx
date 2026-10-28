"use client";

import { LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logout } from "@/features/auth/actions";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { isActive, visibleItems } from "./nav-items";
import type { ShellUser } from "./sidebar-nav";

/** Phone bottom bar: the 4 most used screens + "More" for the rest. */
export function BottomNav({ user }: { user: ShellUser }) {
  const m = useMessages();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = visibleItems(user?.isAdmin ?? false);
  const barItems = items.filter((i) => i.inBottomBar);
  const moreItems = items.filter((i) => !i.inBottomBar);
  const moreActive = moreItems.some((i) => isActive(i.href, pathname));

  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground",
      active && "text-primary",
    );

  return (
    <nav
      aria-label={m.nav.mainNavigation}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="flex">
        {barItems.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <span className={cn("rounded-full px-4 py-1", active && "bg-sidebar-accent")}>
                  <item.icon className="size-6" aria-hidden />
                </span>
                {m.nav[item.label]}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger className={tabClass(moreActive)}>
              <span className={cn("rounded-full px-4 py-1", moreActive && "bg-sidebar-accent")}>
                <MenuIcon className="size-6" aria-hidden />
              </span>
              {m.nav.more}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <SheetHeader>
                <SheetTitle className="text-lg">{m.nav.menu}</SheetTitle>
                {user && (
                  <p className="text-sm text-muted-foreground">
                    {format(m.nav.loggedInAs, { name: user.fullName })}
                  </p>
                )}
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {moreItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive(item.href, pathname) ? "page" : undefined}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-lg font-medium hover:bg-secondary aria-[current=page]:bg-sidebar-accent"
                  >
                    <item.icon className="size-6" aria-hidden />
                    {m.nav[item.label]}
                  </Link>
                ))}
                <form action={logout} className="mt-2 border-t pt-2">
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-lg font-medium hover:bg-secondary"
                  >
                    <LogOutIcon className="size-6" aria-hidden />
                    {m.nav.logout}
                  </button>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
