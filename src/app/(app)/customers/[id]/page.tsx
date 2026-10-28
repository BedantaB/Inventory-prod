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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { CustomerArchiveAction } from "@/features/customers/components/customer-archive-action";
import { getCustomer, listCustomerOrders } from "@/features/customers/queries";
import { format, getMessages } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { parsePage } from "@/lib/list-params";
import { formatINR } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

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
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const history = await listCustomerOrders(customer.id, parsePage(sp.page));

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
              <p className="text-sm text-muted-foreground">
                {format(m.customers.ordersCount, { count: history.total })} ·{" "}
                {formatINR(history.totalPaise)}
              </p>
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
                      <span className="font-semibold">{order.orderNumber}</span>
                      <span className="text-sm text-muted-foreground">
                        {order.completedAt ? formatDate(order.completedAt) : ""}
                      </span>
                    </span>
                    <span className="font-semibold">{formatINR(order.totalPaise ?? 0)}</span>
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
