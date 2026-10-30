import { WalletIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { format, type Messages } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PaymentRow } from "../data";
import { VoidPaymentDialog } from "./void-payment-dialog";

/** A customer's payments, newest first. Voided ones stay, crossed out, with the reason. */
export function PaymentsList({
  rows,
  customerId,
  canVoid,
  m,
}: {
  rows: PaymentRow[];
  customerId: string;
  canVoid: boolean;
  m: Messages;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={WalletIcon}
        title={m.payments.historyEmpty}
        body={m.payments.historyEmptyBody}
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {rows.map((payment) => {
        const voided = Boolean(payment.voidedAt);
        return (
          <li key={payment.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {m.payments[`method${payment.method}`]}
                {voided && (
                  <Badge variant="outline" className="border-destructive text-destructive">
                    {m.payments.voidedBadge}
                  </Badge>
                )}
                {payment.orderId && (
                  <Link
                    href={`/orders/${payment.orderId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {format(m.payments.withOrder, { number: payment.orderNumber ?? "" })}
                  </Link>
                )}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDate(payment.receivedAt)} ·{" "}
                {format(m.payments.by, { name: payment.createdByName })}
                {payment.reference && ` · ${payment.reference}`}
              </span>
              {payment.note && <span className="text-sm">{payment.note}</span>}
              {voided && (
                <span className="text-sm text-destructive">
                  {format(m.payments.voidedLine, {
                    name: payment.voidedByName ?? "",
                    reason: payment.voidReason ?? "",
                  })}
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={cn(
                  "text-lg font-semibold whitespace-nowrap",
                  voided ? "text-muted-foreground line-through" : "text-success",
                )}
              >
                {formatINR(payment.amountPaise)}
              </span>
              {canVoid && !voided && (
                <VoidPaymentDialog
                  customerId={customerId}
                  paymentId={payment.id}
                  amount={formatINR(payment.amountPaise)}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
