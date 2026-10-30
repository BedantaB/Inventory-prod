import { LogOutIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/features/auth/actions";
import { requirePlatformAdmin } from "@/features/auth/session";
import { format, getMessages } from "@/i18n";

/**
 * The platform admin's pages (creating and managing shops). Separate from the shop app: no shop
 * menu, and shop logins are sent back to their own shop.
 */
export default function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const m = getMessages();
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-sidebar">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 md:px-8">
          <Link href="/platform" className="flex min-h-11 flex-1 items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <StoreIcon className="size-6" aria-hidden />
            </span>
            <span className="text-lg font-bold">{m.shops.platformName}</span>
          </Link>
          <Suspense fallback={null}>
            <AdminName />
          </Suspense>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-medium hover:bg-sidebar-accent"
            >
              <LogOutIcon className="size-5" aria-hidden />
              {m.nav.logout}
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        {children}
      </main>
    </div>
  );
}

/** Also the safety net for every platform page: anyone else is sent away. */
async function AdminName() {
  const admin = await requirePlatformAdmin();
  return (
    <span className="hidden truncate text-sm text-muted-foreground sm:block">
      {format(getMessages().nav.loggedInAs, { name: admin.fullName })}
    </span>
  );
}
