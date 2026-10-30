import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterSelect } from "@/components/filter-select";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { CustomerList } from "@/features/customers/components/customer-list";
import { CUSTOMER_SORTS } from "@/features/customers/data";
import { listCustomers } from "@/features/customers/queries";
import { getMessages } from "@/i18n";
import { firstParam, parseChoice, parsePage } from "@/lib/list-params";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.customers.title}
        subtitle={m.customers.subtitle}
        action={
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/customers/new">
              <PlusIcon aria-hidden />
              {m.customers.add}
            </Link>
          </Button>
        }
      />
      <div className="mb-3">
        <Suspense fallback={<Skeleton className="h-12 w-full" />}>
          <SearchBox
            placeholder={m.customers.searchPlaceholder}
            label={m.customers.searchPlaceholder}
          />
        </Suspense>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <CustomersResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomersResults({ searchParams }: Pick<PageProps<"/customers">, "searchParams">) {
  const m = getMessages();
  const user = await requireUser();
  const sp = await searchParams;
  const canSeeArchived = can(user, "archive");
  const view = parseChoice(sp.view, ["active", "archived"] as const, "active");
  const params = {
    q: firstParam(sp.q),
    sort: parseChoice(sp.sort, CUSTOMER_SORTS, "name"),
    page: parsePage(sp.page),
    archived: canSeeArchived && view === "archived",
  };
  const list = await listCustomers(user.shopId, params);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FilterSelect
          param="sort"
          label={m.list.sortBy}
          defaultValue="name"
          options={[
            { value: "name", label: m.customers.sortName },
            { value: "city", label: m.customers.sortCity },
            { value: "recent", label: m.customers.sortRecent },
          ]}
        />
        {canSeeArchived && (
          <FilterSelect
            param="view"
            label={m.list.filters}
            defaultValue="active"
            options={[
              { value: "active", label: m.customers.showActive },
              { value: "archived", label: m.customers.showArchived },
            ]}
          />
        )}
      </div>
      <CustomerList customers={list.rows} filtered={Boolean(params.q || params.archived)} m={m} />
      <Pagination page={list.page} total={list.total} pathname="/customers" searchParams={sp} />
    </>
  );
}
