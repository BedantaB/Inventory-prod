import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { CartEditor } from "@/features/orders/components/cart-editor";
import { OrderDetails } from "@/features/orders/components/order-details";
import { getDraft, getOrder } from "@/features/orders/queries";
import { getShop } from "@/features/shops/queries";
import { format, getMessages } from "@/i18n";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Order" };

/** One page for both: an unfinished order shows the cart, a completed one shows the order. */
export default function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] max-w-3xl" />}>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Order({ params, searchParams }: PageProps<"/orders/[id]">) {
  const m = getMessages();
  const user = await requireUser();
  const showCost = can(user, "viewCost");
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const draft = await getDraft(user.shopId, id, showCost);
  if (draft) {
    return (
      <>
        <PageHeader
          title={m.orders.cartTitle}
          subtitle={format(m.orders.startedBy, {
            name: draft.createdByName,
            time: formatDateTime(draft.createdAt),
          })}
          back={<BackLink href="/orders/new" label={m.orders.unfinished} />}
        />
        <CartEditor key={draft.id} draft={draft} />
      </>
    );
  }

  const [order, shop] = await Promise.all([
    getOrder(user.shopId, id, showCost),
    getShop(user.shopId),
  ]);
  if (!order) notFound();
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={format(m.orders.completedTitle, { number: order.orderNumber ?? "" })}
          subtitle={order.customerName}
          back={<BackLink href="/orders" label={m.orders.title} />}
        />
      </div>
      <OrderDetails
        order={order}
        justCompleted={sp.done === "1"}
        canArchive={can(user, "archive")}
        business={{
          name: shop?.name ?? user.shopName,
          address: shop?.address ?? "",
          phone: shop?.phone ?? "",
        }}
        m={m}
      />
    </>
  );
}
