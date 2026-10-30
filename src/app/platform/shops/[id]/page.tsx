import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePlatformAdmin } from "@/features/auth/session";
import { updateShopAction, resetShopLoginPassword } from "@/features/shops/actions";
import { ShopDetailsForm } from "@/features/shops/components/shop-details-form";
import { ShopStatusAction } from "@/features/shops/components/shop-status-action";
import { getShop, listShopOwners } from "@/features/shops/queries";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";
import { StatusBadge } from "@/features/users/components/user-badges";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage({ params }: PageProps<"/platform/shops/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-2xl" />}>
      <Shop params={params} />
    </Suspense>
  );
}

async function Shop({ params }: Pick<PageProps<"/platform/shops/[id]">, "params">) {
  const m = getMessages();
  await requirePlatformAdmin();
  const shop = await getShop((await params).id);
  if (!shop) notFound();
  const owners = await listShopOwners(shop.id);

  return (
    <>
      <PageHeader title={shop.name} back={<BackLink href="/platform" label={m.shops.title} />} />
      <div className="mb-6 flex gap-2">
        <StatusBadge isActive={shop.isActive} m={m} />
      </div>
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{m.shops.detailsTitle}</CardTitle>
            <CardDescription>{m.shops.detailsHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ShopDetailsForm shop={shop} action={updateShopAction.bind(null, shop.id)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{m.shops.ownersTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {owners.length === 0 ? (
              <p className="text-muted-foreground">{m.shops.ownersEmpty}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {owners.map((owner) => (
                  <li
                    key={owner.id}
                    className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-lg font-semibold">{owner.fullName}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {owner.username}
                      </span>
                    </span>
                    <StatusBadge isActive={owner.isActive} m={m} />
                    <ResetPasswordDialog user={owner} action={resetShopLoginPassword} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div>
          <ShopStatusAction shop={shop} />
        </div>
      </div>
    </>
  );
}
