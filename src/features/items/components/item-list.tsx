import { ChevronRightIcon, PackageIcon, PlusIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/i18n";
import { formatINR } from "@/lib/money";
import { formatQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import type { ItemView } from "../data";
import { ItemPhoto } from "./item-photo";
import { StockBadge } from "./stock-badge";

export function ItemList({
  items,
  filtered,
  showCost,
  m,
}: {
  items: ItemView[];
  /** True when a search or filter is active (changes the empty message). */
  filtered: boolean;
  showCost: boolean;
  m: Messages;
}) {
  if (items.length === 0) {
    return filtered ? (
      <EmptyState icon={SearchXIcon} title={m.items.noResults} body={m.items.noResultsBody} />
    ) : (
      <EmptyState
        icon={PackageIcon}
        title={m.items.empty}
        body={m.items.emptyBody}
        action={
          <Button size="lg" asChild>
            <Link href="/items/new">
              <PlusIcon aria-hidden />
              {m.items.emptyAction}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/items/${item.id}`}
            className="flex min-h-16 items-center gap-3 px-3 py-3 hover:bg-secondary sm:px-4"
          >
            <ItemPhoto path={item.photoPath} alt="" className="size-12 sm:size-14" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-semibold sm:text-lg">{item.name}</span>
              <span className="truncate text-sm text-muted-foreground">
                {[item.sku, item.packSize, item.categoryName].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span
                className={cn(
                  "text-base font-semibold whitespace-nowrap",
                  item.status === "out" && "text-destructive",
                )}
              >
                {formatQty(item.stockMilli)} {item.unitName}
              </span>
              <StockBadge status={item.status} m={m} />
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {item.sellingPricePaise != null
                  ? formatINR(item.sellingPricePaise)
                  : m.items.noPrice}
                {showCost && (
                  <span className="hidden md:inline">
                    {" · "}
                    {m.items.avgCost}: {formatINR(item.avgCostPaise)}
                  </span>
                )}
              </span>
            </span>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
