import { ChevronRightIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/features/users/components/user-badges";
import { format, type Messages } from "@/i18n";
import { formatDate } from "@/lib/dates";
import type { ShopRow } from "../data";

export function ShopsList({ shops, m }: { shops: ShopRow[]; m: Messages }) {
  if (shops.length === 0) {
    return <EmptyState icon={StoreIcon} title={m.shops.empty} body={m.shops.emptyBody} />;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {shops.map((shop) => (
        <li key={shop.id}>
          <Link
            href={`/platform/shops/${shop.id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-secondary"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-lg font-semibold">{shop.name}</span>
              <span className="truncate text-sm text-muted-foreground">
                {format(m.shops.listLine, {
                  logins: shop.activeLogins,
                  date: formatDate(shop.createdAt),
                })}
              </span>
            </span>
            <StatusBadge isActive={shop.isActive} m={m} />
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
