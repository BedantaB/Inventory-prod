import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { BottomNavSkeleton, SidebarNavSkeleton } from "@/components/shell/nav-skeleton";
import { SidebarNav, type ShellUser } from "@/components/shell/sidebar-nav";
import { getSession } from "@/features/auth/session";
import { getMessages } from "@/i18n";

/**
 * Logged-in app frame: sidebar on desktop, bottom bar on phones.
 * The frame renders instantly; the menu appears once the login is read (a few milliseconds).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const m = getMessages();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr] print:block">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {m.nav.skipToContent}
      </a>
      <aside className="hidden border-r bg-sidebar md:sticky md:top-0 md:block md:h-dvh print:hidden">
        <Suspense fallback={<SidebarNavSkeleton />}>
          <SidebarWithUser />
        </Suspense>
      </aside>
      <main
        id="main"
        className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 md:px-8 md:py-8 print:max-w-none print:p-0"
      >
        {children}
      </main>
      <Suspense fallback={<BottomNavSkeleton />}>
        <BottomNavWithUser />
      </Suspense>
    </div>
  );
}

/**
 * Also the safety net for every page in the app: a signed-out or turned-off login is sent away
 * even on pages that don't load any data themselves.
 */
async function shellUser(): Promise<NonNullable<ShellUser>> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  if (session.status === "inactive") redirect("/auth/signout?reason=inactive");
  return { fullName: session.user.fullName, isAdmin: session.user.role === "ADMIN" };
}

async function SidebarWithUser() {
  return <SidebarNav user={await shellUser()} />;
}

async function BottomNavWithUser() {
  return <BottomNav user={await shellUser()} />;
}
