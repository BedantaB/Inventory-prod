import { CopyPlusIcon, PackagePlusIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { Pagination } from "@/components/pagination";
import { StockHistory } from "@/features/inventory/components/stock-history";
import { listItemMovements } from "@/features/inventory/queries";
import { ItemArchiveAction } from "@/features/items/components/item-archive-action";
import { ItemPhoto } from "@/features/items/components/item-photo";
import { StockBadge } from "@/features/items/components/stock-badge";
import { itemDisplayName } from "@/features/items/data";
import { getItem } from "@/features/items/queries";
import { format, getMessages } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { parsePage } from "@/lib/list-params";
import { formatQty, lineTotalPaise } from "@/lib/qty";

export const metadata: Metadata = { title: "Item" };

export default function ItemPage({ params, searchParams }: PageProps<"/items/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
      <ItemDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ItemDetails({ params, searchParams }: PageProps<"/items/[id]">) {
  const m = getMessages();
  const user = await requireUser();
  const [item, sp] = await Promise.all([getItem((await params).id), searchParams]);
  if (!item) notFound();
  const history = await listItemMovements(item.id, parsePage(sp.page));
  const showCost = can(user, "viewCost");
  const unit = item.unitName;

  const money = (paise: number | null) => (paise != null ? formatINR(paise) : m.items.noPrice);
  const facts: [string, string][] = [
    [m.items.mrp, money(item.mrpPaise)],
    [m.items.sellingPrice, money(item.sellingPricePaise)],
    [m.items.variant, item.variant ?? "—"],
    [m.items.brand, item.brandName ?? m.items.noBrand],
    [m.items.unit, unit],
    [m.items.packSize, item.packSize ?? "—"],
    [m.items.category, item.categoryName ?? m.items.noCategory],
    [m.items.lowStock, `${formatQty(item.lowStockMilli)} ${unit}`],
    [m.items.sku, item.sku],
  ];

  return (
    <>
      <PageHeader
        title={itemDisplayName(item)}
        subtitle={format(m.items.addedOn, { date: formatDate(item.createdAt) })}
        back={<BackLink href="/items" label={m.items.title} />}
        action={
          !item.archivedAt && (
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href={`/items/${item.id}/edit`}>
                <PencilIcon aria-hidden />
                {m.common.edit}
              </Link>
            </Button>
          )
        }
      />

      {item.archivedAt && (
        <Alert className="mb-6 border-warning">
          <AlertDescription className="text-base">{m.items.archivedNotice}</AlertDescription>
        </Alert>
      )}

      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardContent className="flex flex-col gap-5 sm:flex-row">
            <ItemPhoto
              path={item.photoPath}
              alt={itemDisplayName(item)}
              size="full"
              className="size-40 self-center sm:self-start"
            />
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{m.items.currentStock}</p>
                <p className="flex flex-wrap items-center gap-2 text-3xl font-bold">
                  {formatQty(item.stockMilli)} {unit}
                  <StockBadge status={item.status} m={m} />
                </p>
              </div>
              {showCost && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{m.items.avgCost}</p>
                    <p className="text-xl font-semibold">{formatINR(item.avgCostPaise)}</p>
                    <p className="text-xs text-muted-foreground">{m.items.avgCostHint}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{m.items.stockValue}</p>
                    <p className="text-xl font-semibold">
                      {formatINR(lineTotalPaise(Math.max(0, item.stockMilli), item.avgCostPaise))}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.items.stockValueHint}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{m.items.details}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-base font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <section aria-labelledby="history-heading">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="history-heading" className="text-xl font-bold">
              {m.stock.history}
            </h2>
            {!item.archivedAt && (
              <Button variant="outline" asChild>
                <Link href="/stock/new">
                  <PackagePlusIcon aria-hidden />
                  {m.nav.addStock}
                </Link>
              </Button>
            )}
          </div>
          <StockHistory rows={history.rows} unit={unit} showCost={showCost} m={m} />
          <Pagination
            page={history.page}
            total={history.total}
            pathname={`/items/${item.id}`}
            searchParams={sp}
          />
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          {!item.archivedAt && (
            <Button size="lg" variant="outline" asChild>
              <Link href={`/items/new?copy=${item.id}`}>
                <CopyPlusIcon aria-hidden />
                {m.items.addVariant}
              </Link>
            </Button>
          )}
          {can(user, "archive") && (
            <ItemArchiveAction
              id={item.id}
              name={itemDisplayName(item)}
              archived={Boolean(item.archivedAt)}
            />
          )}
        </div>
      </div>
    </>
  );
}
