import { ChevronRightIcon, ShoppingCartIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/session";
import { startOrderAction } from "@/features/orders/actions";
import { StartOrderButton } from "@/features/orders/components/start-order-button";
import { listDrafts } from "@/features/orders/queries";
import { format, getMessages } from "@/i18n";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "New Order" };

export default function NewOrderPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader title={m.orders.newTitle} subtitle={m.orders.newSubtitle} />
      <form action={startOrderAction.bind(null, null)} className="mb-8">
        <StartOrderButton />
      </form>
      <section aria-labelledby="drafts-heading" className="max-w-3xl">
        <h2 id="drafts-heading" className="text-xl font-bold">
          {m.orders.unfinished}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{m.orders.unfinishedHint}</p>
        <Suspense fallback={<ListSkeleton rows={3} />}>
          <Drafts />
        </Suspense>
      </section>
    </>
  );
}

async function Drafts() {
  const m = getMessages();
  await requireUser();
  const drafts = await listDrafts();
  if (drafts.length === 0) {
    return <EmptyState icon={ShoppingCartIcon} title={m.orders.noUnfinished} />;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {drafts.map((d) => (
        <li key={d.id}>
          <Link
            href={`/orders/${d.id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-secondary"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-lg font-semibold">
                {d.customerName ?? m.orders.noCustomerYet}
              </span>
              <span className="text-sm text-muted-foreground">
                {format(m.orders.linesCount, { count: d.lineCount })} ·{" "}
                {format(m.orders.startedBy, {
                  name: d.createdByName,
                  time: formatDateTime(d.updatedAt),
                })}
              </span>
            </span>
            <span className="text-base font-medium text-primary">{m.orders.continue}</span>
            <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
