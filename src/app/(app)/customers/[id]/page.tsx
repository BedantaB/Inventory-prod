import { PencilIcon, PhoneIcon, ReceiptTextIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { startOrderAction } from "@/features/orders/actions";
import { StartOrderButton } from "@/features/orders/components/start-order-button";
import { CustomerArchiveAction } from "@/features/customers/components/customer-archive-action";
import { getCustomer, listCustomerOrders } from "@/features/customers/queries";
import { PaymentsList } from "@/features/payments/components/payments-list";
import { RecordPaymentDialog } from "@/features/payments/components/record-payment-dialog";
import { customerBalance, listCustomerPayments } from "@/features/payments/queries";
import { format, getMessages } from "@/i18n";
import { formatDate, istDateString } from "@/lib/dates";
import { parsePage } from "@/lib/list-params";
import { formatINR } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer" };

export default function CustomerPage({ params, searchParams }: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
      <CustomerDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerDetails({ params, searchParams }: PageProps<"/customers/[id]">) {
  const m = getMessages();
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const customer = await getCustomer(user.shopId, id);
  if (!customer) notFound();
  const [history, balance, paymentList] = await Promise.all([
    listCustomerOrders(user.shopId, customer.id, parsePage(sp.page)),
    customerBalance(user.shopId, customer.id),
    listCustomerPayments(user.shopId, customer.id, parsePage(sp.ppage)),
  ]);
  const outstanding = balance.outstandingPaise;

  const facts: [string, string | null][] = [
    [m.customers.contactPerson, customer.contactPerson],
    [m.customers.city, customer.city],
    [m.customers.address, customer.address],
    [m.customers.email, customer.email],
    [m.customers.notes, customer.notes],
  ];

  return (
    <>
      <PageHeader
        title={customer.businessName}
        subtitle={format(m.customers.addedOn, { date: formatDate(customer.createdAt) })}
        back={<BackLink href="/customers" label={m.customers.title} />}
        action={
          !customer.archivedAt && (
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href={`/customers/${customer.id}/edit`}>
                <PencilIcon aria-hidden />
                {m.common.edit}
              </Link>
            </Button>
          )
        }
      />

      {customer.archivedAt && (
        <Alert className="mb-6 border-warning">
          <AlertDescription className="text-base">{m.customers.archivedNotice}</AlertDescription>
        </Alert>
      )}

      <div className="grid max-w-3xl gap-6">
        {!customer.archivedAt && (
          <form action={startOrderAction.bind(null, customer.id)}>
            <StartOrderButton label={m.orders.newForCustomer} />
          </form>
        )}
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {outstanding > 0
                  ? m.payments.owes
                  : outstanding < 0
                    ? m.payments.advance
                    : m.payments.outstanding}
              </p>
              <p
                className={cn(
                  "text-3xl font-bold",
                  outstanding > 0 ? "text-destructive" : outstanding < 0 && "text-success",
                )}
                data-testid="customer-outstanding"
              >
                {formatINR(Math.abs(outstanding))}
              </p>
              <p className="text-sm text-muted-foreground">
                {m.payments.ordersTotal} {formatINR(balance.ordersPaise)} · {m.payments.paidTotal}{" "}
                {formatINR(balance.paidPaise)}
              </p>
            </div>
            <RecordPaymentDialog
              customer={{ id: customer.id, name: customer.businessName }}
              today={istDateString(new Date())}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{m.customers.details}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <a
              href={`tel:${customer.phone}`}
              className="flex min-h-11 w-fit items-center gap-2 rounded-lg text-xl font-semibold text-primary hover:underline"
            >
              <PhoneIcon className="size-5" aria-hidden />
              {formatPhone(customer.phone)}
            </a>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-base font-medium whitespace-pre-line">{value}</dd>
                  </div>
                ))}
            </dl>
          </CardContent>
        </Card>

        <section aria-labelledby="orders-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="orders-heading" className="text-xl font-bold">
              {m.customers.orderHistory}
            </h2>
            {history.total > 0 && (
              <Link
                href={`/orders?customer=${customer.id}`}
                className="text-sm text-primary hover:underline"
              >
                {format(m.customers.ordersCount, { count: history.completed })} ·{" "}
                {formatINR(history.totalPaise)}
              </Link>
            )}
          </div>
          {history.rows.length === 0 ? (
            <EmptyState
              icon={ReceiptTextIcon}
              title={m.customers.noOrders}
              body={m.customers.noOrdersBody}
            />
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {history.rows.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-secondary"
                  >
                    <span className="flex flex-col">
                      <span className="flex items-center gap-2 font-semibold">
                        {order.orderNumber}
                        {order.status === "CANCELLED" && (
                          <Badge variant="outline" className="border-destructive text-destructive">
                            {m.orders.cancelledBadge}
                          </Badge>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {order.completedAt ? formatDate(order.completedAt) : ""}
                      </span>
                    </span>
                    <span
                      className={
                        order.status === "CANCELLED"
                          ? "text-muted-foreground line-through"
                          : "font-semibold"
                      }
                    >
                      {formatINR(order.totalPaise ?? 0)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={history.page}
            total={history.total}
            pathname={`/customers/${customer.id}`}
            searchParams={sp}
          />
        </section>

        <section aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="mb-3 text-xl font-bold">
            {m.payments.history}
          </h2>
          <PaymentsList
            rows={paymentList.rows}
            customerId={customer.id}
            canVoid={can(user, "voidPayment")}
            m={m}
          />
          <Pagination
            page={paymentList.page}
            total={paymentList.total}
            pathname={`/customers/${customer.id}`}
            searchParams={sp}
            param="ppage"
          />
        </section>

        {can(user, "archive") && (
          <div>
            <CustomerArchiveAction
              id={customer.id}
              name={customer.businessName}
              archived={Boolean(customer.archivedAt)}
            />
          </div>
        )}
      </div>
    </>
  );
}
