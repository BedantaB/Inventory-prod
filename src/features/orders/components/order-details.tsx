import { BanIcon, CheckCircle2Icon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { format, type Messages } from "@/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatQty } from "@/lib/qty";
import type { OrderView } from "../data";
import { percentToInput } from "../totals";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { OrderArchiveAction } from "./order-archive-action";
import { PrintButton } from "./print-button";

/**
 * A completed order, laid out to print cleanly on A4 (menus and buttons are hidden on paper).
 */
export function OrderDetails({
  order,
  justCompleted,
  canArchive,
  canCancel,
  business,
  m,
}: {
  order: OrderView;
  justCompleted: boolean;
  canArchive: boolean;
  canCancel: boolean;
  business: { name: string; address: string; phone: string };
  m: Messages;
}) {
  const number = order.orderNumber ?? "";
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="flex max-w-3xl flex-col gap-6 print:max-w-none print:gap-4">
      {cancelled && (
        <Alert className="border-destructive print:hidden" role="status">
          <BanIcon className="text-destructive" aria-hidden />
          <AlertTitle className="text-lg">{m.orders.cancelledBadge}</AlertTitle>
          <AlertDescription className="text-base">
            <p>
              {format(m.orders.cancelledNotice, {
                date: order.cancelledAt ? formatDateTime(order.cancelledAt) : "",
                name: order.cancelledByName ?? "",
              })}
            </p>
            <p>{format(m.orders.cancelledReason, { reason: order.cancelReason ?? "" })}</p>
          </AlertDescription>
        </Alert>
      )}
      {justCompleted && !cancelled && (
        <Alert className="border-success print:hidden" role="status">
          <CheckCircle2Icon className="text-success" aria-hidden />
          <AlertTitle className="text-lg">{format(m.orders.completedTitle, { number })}</AlertTitle>
          <AlertDescription className="text-base">{m.orders.completedBanner}</AlertDescription>
        </Alert>
      )}
      {order.archivedAt && (
        <Alert className="border-warning print:hidden">
          <AlertDescription className="text-base">{m.orders.archivedNotice}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        <Button size="lg" asChild>
          <Link href="/orders/new">
            <ShoppingCartIcon aria-hidden />
            {m.orders.another}
          </Link>
        </Button>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground print:hidden">{m.orders.printHint}</p>

      <article className="flex flex-col gap-5 rounded-xl border bg-card p-5 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row print:flex-row">
          <div>
            <p className="text-2xl font-bold">{business.name}</p>
            {business.address && <p className="text-sm">{business.address}</p>}
            {business.phone && <p className="text-sm">{business.phone}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 text-sm sm:text-right print:text-right">
            <dt className="text-muted-foreground">{m.orders.orderNumber}</dt>
            <dd className="font-semibold whitespace-nowrap">{number}</dd>
            <dt className="text-muted-foreground">{m.orders.date}</dt>
            <dd className="whitespace-nowrap">{formatDateTime(order.completedAt)}</dd>
          </dl>
        </header>
        {cancelled && (
          <p className="self-start rounded border-2 border-destructive px-3 py-1 text-xl font-bold tracking-widest text-destructive">
            {m.orders.cancelledStamp}
          </p>
        )}

        <section>
          <h2 className="text-sm text-muted-foreground">{m.orders.billTo}</h2>
          <p className="text-lg font-semibold">
            <Link
              href={`/customers/${order.customerId}`}
              className="hover:underline print:no-underline"
            >
              {order.customerName}
            </Link>
          </p>
          <p className="text-sm">
            {[order.customerAddress, order.customerCity].filter(Boolean).join(", ")}
            {order.customerPhone && ` · ${formatPhone(order.customerPhone)}`}
          </p>
        </section>

        <table className="w-full text-left text-sm sm:text-base">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">{m.orders.item}</th>
              <th className="py-2 pr-2 text-right font-medium">{m.orders.qty}</th>
              <th className="py-2 pr-2 text-right font-medium">{m.orders.rate}</th>
              <th className="py-2 text-right font-medium">{m.orders.amount}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line, index) => (
              <tr key={line.id} className="border-b align-top">
                <td className="py-2 pr-2">{index + 1}</td>
                <td className="py-2 pr-2">
                  <span className="font-medium">{line.label}</span>
                  {line.packSize && (
                    <span className="block text-xs text-muted-foreground">{line.packSize}</span>
                  )}
                  {line.unitCostPaise !== null && (
                    <span className="block text-xs text-muted-foreground print:hidden">
                      {format(m.orders.costLine, { cost: formatINR(line.unitCostPaise) })}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right whitespace-nowrap">
                  {formatQty(line.qtyMilli)} {line.unitName}
                </td>
                <td className="py-2 pr-2 text-right whitespace-nowrap">
                  {formatINR(line.unitPricePaise)}
                </td>
                <td className="py-2 text-right font-medium whitespace-nowrap">
                  {formatINR(line.lineTotalPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-base">
          <dt>{m.orders.subtotal}</dt>
          <dd className="text-right">{formatINR(order.subtotalPaise)}</dd>
          {order.discountPaise > 0 && (
            <>
              <dt>
                {m.orders.discount}
                {order.discountKind === "PERCENT" && ` (${percentToInput(order.discountValue)}%)`}
              </dt>
              <dd className="text-right">− {formatINR(order.discountPaise)}</dd>
            </>
          )}
          <dt className="border-t pt-2 text-lg font-bold">{m.orders.total}</dt>
          <dd className="border-t pt-2 text-right text-lg font-bold">
            {formatINR(order.totalPaise)}
          </dd>
        </dl>

        <p className="text-sm text-muted-foreground">
          {format(m.orders.soldBy, { name: order.completedByName })}
        </p>
      </article>

      {(canCancel || canArchive) && (
        <div className="flex flex-wrap gap-3 print:hidden">
          {canCancel && !cancelled && <CancelOrderDialog id={order.id} number={number} />}
          {canArchive && (
            <OrderArchiveAction
              id={order.id}
              number={number}
              archived={Boolean(order.archivedAt)}
            />
          )}
        </div>
      )}
    </div>
  );
}
