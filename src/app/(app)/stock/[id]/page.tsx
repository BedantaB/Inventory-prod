import { CheckCircle2Icon, PackagePlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { getStockEntry } from "@/features/inventory/queries";
import { itemDisplayName } from "@/features/items/data";
import { format, getMessages } from "@/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatQty, lineTotalPaise } from "@/lib/qty";

export const metadata: Metadata = { title: "Stock added" };

export default function StockEntryPage({ params }: PageProps<"/stock/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
      <StockEntry params={params} />
    </Suspense>
  );
}

async function StockEntry({ params }: Pick<PageProps<"/stock/[id]">, "params">) {
  const m = getMessages();
  const user = await requireUser();
  const entry = await getStockEntry((await params).id);
  if (!entry) notFound();
  const showCost = can(user, "viewCost");
  const total = entry.lines.reduce(
    (sum, l) => sum + lineTotalPaise(l.qtyMilli, l.unitCostPaise),
    0,
  );

  return (
    <>
      <PageHeader
        title={m.stock.savedTitle}
        subtitle={format(m.stock.savedSubtitle, {
          date: formatDateTime(entry.createdAt),
          name: entry.createdByName,
        })}
        action={
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/stock/new">
              <PackagePlusIcon aria-hidden />
              {m.stock.addMore}
            </Link>
          </Button>
        }
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2Icon className="size-6 text-success" aria-hidden />
              {entry.reference ?? m.stock.noReference}
            </p>
            {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
          </CardContent>
        </Card>

        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {entry.lines.map((line) => (
            <li key={line.movementId}>
              <Link
                href={`/items/${line.itemId}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-secondary"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 font-semibold break-words">
                    {itemDisplayName(line)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(m.stock.after, {
                      stock: `${formatQty(line.stockAfterMilli)} ${line.unitName}`,
                    })}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="font-semibold whitespace-nowrap text-success">
                    +{formatQty(line.qtyMilli)} {line.unitName}
                  </span>
                  {showCost && (
                    <span className="text-sm whitespace-nowrap text-muted-foreground">
                      {format(m.stock.costEach, { cost: formatINR(line.unitCostPaise) })}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {showCost && (
          <p className="text-right text-lg">
            {m.stock.totalCost}: <span className="font-bold">{formatINR(total)}</span>
          </p>
        )}
      </div>
    </>
  );
}
