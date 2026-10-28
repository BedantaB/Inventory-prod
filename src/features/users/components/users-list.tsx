import { ChevronRightIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { format, type Messages } from "@/i18n";
import type { UserRow } from "../queries";
import { RoleBadge, StatusBadge } from "./user-badges";

export function UsersList({
  users,
  query,
  currentUserId,
  m,
}: {
  users: UserRow[];
  query?: string;
  currentUserId: string;
  m: Messages;
}) {
  if (users.length === 0) {
    return query ? (
      <EmptyState
        icon={SearchXIcon}
        title={format(m.users.noResults, { query })}
        body={m.users.noResultsBody}
      />
    ) : (
      <EmptyState icon={UsersIcon} title={m.users.empty} body={m.users.emptyBody} />
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {users.map((user) => (
        <li key={user.id}>
          <Link
            href={`/users/${user.id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-secondary"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-lg font-semibold">
                {user.fullName}
                {user.id === currentUserId && (
                  <span className="font-normal text-muted-foreground"> ({m.users.you})</span>
                )}
              </span>
              <span className="truncate text-sm text-muted-foreground">{user.username}</span>
            </span>
            <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
              <RoleBadge role={user.role} m={m} />
              <StatusBadge isActive={user.isActive} m={m} />
            </span>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
