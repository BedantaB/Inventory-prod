import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  IndianRupeeIcon,
  PackageIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { format, type Messages } from "@/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import type { Dashboard } from "../data";

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "warn";
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon
          className={cn("size-5", tone === "warn" ? "text-destructive" : "text-primary")}
          aria-hidden
        />
        {label}
      </span>
      <span className="text-2xl font-bold sm:text-3xl">{value}</span>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </>
  );
  const className = "flex min-h-28 flex-col gap-1 rounded-xl border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(className, "hover:bg-secondary")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function DashboardView({ data, m }: { data: Dashboard; m: Messages }) {
  const attention = data.lowCount + data.outCount;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          {
            href: "/orders/new",
            icon: ShoppingCartIcon,
            label: m.nav.newOrder,
            hint: m.home.newOrderHint,
          },
          {
            href: "/stock/new",
            icon: PackagePlusIcon,
            label: m.nav.addStock,
            hint: m.home.addStockHint,
          },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="flex min-h-20 items-center gap-4 rounded-xl bg-primary p-4 text-primary-foreground hover:bg-primary/90"
          >
            <tile.icon className="size-8 shrink-0" aria-hidden />
            <span className="flex flex-col">
              <span className="text-lg font-semibold">{tile.label}</span>
              <span className="text-sm text-primary-foreground/90">{tile.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      {data.drafts > 0 && (
        <Link
          href="/orders/new"
          className="flex min-h-12 items-center gap-2 rounded-lg border border-warning bg-warning/15 px-4 py-2 font-medium"
        >
          <ClipboardListIcon className="size-5" aria-hidden />
          {format(m.home.unfinished, { count: data.drafts })}
          <ChevronRightIcon className="ml-auto size-5" aria-hidden />
        </Link>
      )}

      <section aria-label={m.home.summary} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={IndianRupeeIcon}
          label={m.home.todaySales}
          value={formatINR(data.today.salesPaise)}
          hint={format(m.home.ordersToday, { count: data.today.orders })}
          href="/orders"
        />
        <Stat
          icon={PackageIcon}
          label={m.home.activeItems}
          value={data.activeItems.toLocaleString("en-IN")}
          hint={m.home.activeItemsHint}
          href="/items"
        />
        {data.stockValuePaise !== null && (
          <Stat
            icon={WalletIcon}
            label={m.home.stockValue}
            value={formatINR(data.stockValuePaise)}
            hint={m.home.stockValueHint}
          />
        )}
        <Stat
          icon={AlertTriangleIcon}
          label={m.home.attention}
          value={attention.toLocaleString("en-IN")}
          hint={format(m.home.attentionHint, { low: data.lowCount, out: data.outCount })}
          href="/items?sort=stock-asc"
          tone={attention > 0 ? "warn" : "default"}
        />
      </section>

      {/* minmax(0,1fr): long names must not widen the columns past the screen. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section aria-labelledby="low-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="low-heading" className="text-xl font-bold">
            {m.home.lowStockTitle}
          </h2>
          {data.lowStock.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              {m.home.lowStockEmpty}
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {data.lowStock.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/items/${item.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-secondary"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 font-medium">{item.label}</span>
                      {item.packSize && (
                        <span className="truncate text-sm text-muted-foreground">
                          {item.packSize}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span
                        className={cn(
                          "font-semibold whitespace-nowrap",
                          item.stockMilli <= 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {format(m.home.left, {
                          stock: `${formatQty(item.stockMilli)} ${item.unitName}`,
                        })}
                      </span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        {format(m.home.warnAt, { level: formatQty(item.lowStockMilli) })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {attention > data.lowStock.length && (
            <Link href="/items?sort=stock-asc" className="w-fit py-2 text-primary hover:underline">
              {m.home.seeAllLow}
            </Link>
          )}
        </section>

        <section aria-labelledby="recent-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="recent-heading" className="text-xl font-bold">
            {m.home.recentTitle}
          </h2>
          {data.recent.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              {m.home.recentEmpty}
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {data.recent.map((event) => (
                <li key={`${event.kind}-${event.id}`}>
                  <Link
                    href={event.kind === "order" ? `/orders/${event.id}` : `/stock/${event.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-secondary"
                  >
                    {event.kind === "order" ? (
                      <ReceiptTextIcon className="size-5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <PackagePlusIcon className="size-5 shrink-0 text-success" aria-hidden />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {event.kind === "order"
                          ? format(m.home.recentOrder, { number: event.title ?? "" })
                          : m.home.recentStock}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {event.kind === "order"
                          ? format(m.home.recentOrderDetail, {
                              customer: event.customerName,
                              name: event.byName,
                            })
                          : format(m.home.recentStockDetail, {
                              reference: event.title ?? m.home.noReference,
                              count: event.lineCount,
                              name: event.byName,
                            })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.at)}
                      </span>
                    </span>
                    {event.totalPaise !== null && (
                      <span className="shrink-0 font-semibold whitespace-nowrap">
                        {formatINR(event.totalPaise)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
