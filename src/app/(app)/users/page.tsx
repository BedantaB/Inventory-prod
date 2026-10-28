import { UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/features/auth/session";
import { UsersList } from "@/features/users/components/users-list";
import { listUsers } from "@/features/users/queries";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Staff & Logins" };

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.users.title}
        subtitle={m.users.subtitle}
        action={
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/users/new">
              <UserPlusIcon aria-hidden />
              {m.users.add}
            </Link>
          </Button>
        }
      />
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-12 w-full" />}>
          <SearchBox placeholder={m.users.searchPlaceholder} label={m.users.searchPlaceholder} />
        </Suspense>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <UsersResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UsersResults({ searchParams }: Pick<PageProps<"/users">, "searchParams">) {
  const actor = await requireAdminPage();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : undefined;
  const users = await listUsers(query);
  return <UsersList users={users} query={query} currentUserId={actor.id} m={getMessages()} />;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
