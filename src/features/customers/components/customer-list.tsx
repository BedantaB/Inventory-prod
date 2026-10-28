import { ChevronRightIcon, PhoneIcon, PlusIcon, SearchXIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { format, type Messages } from "@/i18n";
import { formatPhone } from "@/lib/phone";

type CustomerRow = {
  id: string;
  businessName: string;
  contactPerson: string | null;
  phone: string;
  city: string | null;
  orderCount: number;
};

export function CustomerList({
  customers,
  filtered,
  m,
}: {
  customers: CustomerRow[];
  filtered: boolean;
  m: Messages;
}) {
  if (customers.length === 0) {
    return filtered ? (
      <EmptyState
        icon={SearchXIcon}
        title={m.customers.noResults}
        body={m.customers.noResultsBody}
      />
    ) : (
      <EmptyState
        icon={StoreIcon}
        title={m.customers.empty}
        body={m.customers.emptyBody}
        action={
          <Button size="lg" asChild>
            <Link href="/customers/new">
              <PlusIcon aria-hidden />
              {m.customers.emptyAction}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {customers.map((c) => (
        <li key={c.id} className="flex items-center">
          <Link
            href={`/customers/${c.id}`}
            className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-secondary"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-semibold sm:text-lg">{c.businessName}</span>
              <span className="truncate text-sm text-muted-foreground">
                {[c.contactPerson, c.city, formatPhone(c.phone)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="hidden text-sm whitespace-nowrap text-muted-foreground sm:inline">
              {format(m.customers.ordersCount, { count: c.orderCount })}
            </span>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <a
            href={`tel:${c.phone}`}
            className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-secondary"
            aria-label={`${m.customers.call} ${c.businessName}`}
          >
            <PhoneIcon className="size-5" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
