import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { format, type Messages } from "@/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import type { listItemMovements } from "../data";

type Movement = Awaited<ReturnType<typeof listItemMovements>>["rows"][number];

/** Every stock change for one item: added, sold or corrected, with who, when and which bill/order. */
export function StockHistory({
  rows,
  unit,
  showCost,
  m,
}: {
  rows: Movement[];
  unit: string;
  showCost: boolean;
  m: Messages;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={HistoryIcon} title={m.stock.historyEmpty} body={m.stock.historyEmptyBody} />
    );
  }

  const label = {
    IN: m.stock.typeIn,
    OUT: m.stock.typeOut,
    ADJUST: m.stock.typeAdjust,
    RETURN: m.stock.typeReturn,
  } as const;

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {rows.map((row) => {
        const positive = row.qtyMilli > 0;
        const link = row.stockEntryId
          ? { href: `/stock/${row.stockEntryId}`, text: row.entryReference ?? m.stock.noReference }
          : row.orderId
            ? { href: `/orders/${row.orderId}`, text: row.orderNumber ?? "" }
            : null;
        return (
          <li key={row.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.type === "IN" ? "secondary" : "outline"} className="text-sm">
                  {label[row.type]}
                </Badge>
                {link && (
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {link.text}
                  </Link>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDateTime(row.createdAt)} · {format(m.stock.by, { name: row.createdByName })}
              </span>
              {row.type === "IN" && showCost && row.unitCostPaise != null && (
                <span className="text-sm text-muted-foreground">
                  {format(m.stock.costEach, { cost: formatINR(row.unitCostPaise) })}
                </span>
              )}
              {row.type === "OUT" && row.unitPricePaise != null && (
                <span className="text-sm text-muted-foreground">
                  {format(m.stock.priceEach, { price: formatINR(row.unitPricePaise) })}
                </span>
              )}
              {row.type === "RETURN" && (
                <span className="text-sm text-muted-foreground">
                  {format(m.stock.returnedFrom, { number: row.orderNumber ?? "" })}
                </span>
              )}
              {row.type === "ADJUST" && row.reason && (
                <span className="text-sm">
                  {m.stock[`reason${row.reason}`]}
                  {row.note && <span className="text-muted-foreground"> · {row.note}</span>}
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span
                className={cn(
                  "text-lg font-semibold whitespace-nowrap",
                  positive ? "text-success" : "text-destructive",
                )}
              >
                {positive ? "+" : "−"}
                {formatQty(Math.abs(row.qtyMilli))} {unit}
              </span>
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {format(m.stock.after, { stock: `${formatQty(row.stockAfterMilli)} ${unit}` })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
