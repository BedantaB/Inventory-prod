import { PlusIcon, RulerIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { ITEM_SORTS, STOCK_FILTERS } from "@/features/items/data";
import { ItemFilters } from "@/features/items/components/item-filters";
import { ItemList } from "@/features/items/components/item-list";
import { listCategories, listItems } from "@/features/items/queries";
import { getMessages } from "@/i18n";
import { firstParam, parseChoice, parsePage } from "@/lib/list-params";

export const metadata: Metadata = { title: "Items" };

export default function ItemsPage({ searchParams }: PageProps<"/items">) {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.items.title}
        subtitle={m.items.subtitle}
        action={
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/items/new">
              <PlusIcon aria-hidden />
              {m.items.add}
            </Link>
          </Button>
        }
      />
      <div className="mb-3">
        <Suspense fallback={<Skeleton className="h-12 w-full" />}>
          <SearchBox placeholder={m.items.searchPlaceholder} label={m.items.searchPlaceholder} />
        </Suspense>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <ItemsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ItemsResults({ searchParams }: Pick<PageProps<"/items">, "searchParams">) {
  const m = getMessages();
  const user = await requireUser();
  const sp = await searchParams;

  const stockParam = parseChoice(sp.stock, [...STOCK_FILTERS, "archived"] as const, "all");
  const archived = stockParam === "archived" && can(user, "archive");
  const category = firstParam(sp.category);
  const params = {
    q: firstParam(sp.q),
    categoryId: category && z.uuid().safeParse(category).success ? category : undefined,
    stock: stockParam === "archived" ? ("all" as const) : stockParam,
    sort: parseChoice(sp.sort, ITEM_SORTS, "name"),
    page: parsePage(sp.page),
    archived,
  };
  const [list, categories] = await Promise.all([listItems(params), listCategories()]);
  const filtered = Boolean(params.q || params.categoryId || params.stock !== "all" || archived);

  return (
    <>
      <div className="mb-4">
        <ItemFilters categories={categories} canSeeArchived={can(user, "archive")} m={m} />
      </div>
      <ItemList items={list.rows} filtered={filtered} showCost={can(user, "viewCost")} m={m} />
      <Pagination page={list.page} total={list.total} pathname="/items" searchParams={sp} />
      {can(user, "manageUnits") && (
        <div className="mt-6">
          <Button variant="ghost" asChild>
            <Link href="/items/units">
              <RulerIcon aria-hidden />
              {m.items.manageUnits}
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
