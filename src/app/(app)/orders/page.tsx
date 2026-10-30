import {
  ChevronRightIcon,
  ReceiptTextIcon,
  SearchXIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect } from "@/components/filter-select";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { getCustomer } from "@/features/customers/queries";
import { ORDER_STATUS_FILTERS } from "@/features/orders/data";
import { listOrders } from "@/features/orders/queries";
import { format, getMessages } from "@/i18n";
import { formatDateTime, istDayStart, nextDay } from "@/lib/dates";
import { firstParam, parseChoice, parsePage } from "@/lib/list-params";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.orders.title}
        subtitle={m.orders.subtitle}
        action={
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/orders/new">
              <ShoppingCartIcon aria-hidden />
              {m.nav.newOrder}
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-3">
        <Suspense fallback={<Skeleton className="h-12 w-full" />}>
          <SearchBox placeholder={m.orders.searchPlaceholder} label={m.orders.searchPlaceholder} />
          <DateRangeFilter fromLabel={m.orders.from} toLabel={m.orders.to} />
        </Suspense>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <OrdersResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrdersResults({ searchParams }: Pick<PageProps<"/orders">, "searchParams">) {
  const m = getMessages();
  const user = await requireUser();
  const sp = await searchParams;
  const canSeeArchived = can(user, "archive");
  const customerParam = firstParam(sp.customer);
  const customerId =
    customerParam && z.uuid().safeParse(customerParam).success ? customerParam : undefined;
  const from = istDayStart(firstParam(sp.from)) ?? undefined;
  const toStart = istDayStart(firstParam(sp.to));
  const params = {
    q: firstParam(sp.q),
    customerId,
    from,
    to: toStart ? nextDay(toStart) : undefined,
    status: parseChoice(sp.status, ORDER_STATUS_FILTERS, "all"),
    page: parsePage(sp.page),
    archived:
      canSeeArchived &&
      parseChoice(sp.view, ["active", "archived"] as const, "active") === "archived",
  };
  const [list, customer] = await Promise.all([
    listOrders(user.shopId, params),
    customerId ? getCustomer(user.shopId, customerId) : null,
  ]);
  const filtered = Boolean(
    params.q || customerId || from || toStart || params.archived || params.status !== "all",
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {customer && (
            // The chip says which customer is shown; the ✕ is its own link to show everyone.
            <span className="inline-flex items-center rounded-lg bg-secondary pl-3 text-sm font-medium">
              {format(m.orders.customerFilter, { name: customer.businessName })}
              <Link
                href="/orders"
                aria-label={m.orders.clearCustomer}
                className="flex size-11 items-center justify-center rounded-lg hover:bg-background"
              >
                <XIcon className="size-4" aria-hidden />
              </Link>
            </span>
          )}
          <p className="text-base font-medium" aria-live="polite">
            {format(m.orders.summary, { count: list.completed, total: formatINR(list.totalPaise) })}
            {list.cancelled > 0 && (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {format(m.orders.summaryCancelled, { count: list.cancelled })}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:w-56">
            <FilterSelect
              param="status"
              label={m.orders.statusFilter}
              defaultValue="all"
              options={[
                { value: "all", label: m.orders.statusAll },
                { value: "completed", label: m.orders.statusCompleted },
                { value: "cancelled", label: m.orders.statusCancelled },
              ]}
            />
          </div>
          {canSeeArchived && (
            <div className="sm:w-56">
              <FilterSelect
                param="view"
                label={m.list.filters}
                defaultValue="active"
                options={[
                  { value: "active", label: m.orders.showActive },
                  { value: "archived", label: m.orders.showArchived },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {list.rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchXIcon} title={m.orders.noResults} body={m.orders.noResultsBody} />
        ) : (
          <EmptyState icon={ReceiptTextIcon} title={m.orders.empty} body={m.orders.emptyBody} />
        )
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.rows.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-secondary"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base font-semibold sm:text-lg">
                      {order.customerName}
                    </span>
                    {order.status === "CANCELLED" && (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        {m.orders.cancelledBadge}
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {order.orderNumber} · {formatDateTime(order.completedAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(m.orders.linesCount, { count: order.lineCount })}
                  </span>
                </span>
                <span
                  className={
                    order.status === "CANCELLED"
                      ? "text-lg whitespace-nowrap text-muted-foreground line-through"
                      : "text-lg font-bold whitespace-nowrap"
                  }
                >
                  {formatINR(order.totalPaise)}
                </span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={list.page} total={list.total} pathname="/orders" searchParams={sp} />
    </>
  );
}
