import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/features/auth/session";
import { updateOwnShop } from "@/features/shops/actions";
import { ShopDetailsForm } from "@/features/shops/components/shop-details-form";
import { getShop } from "@/features/shops/queries";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Shop settings" };

export default function ShopSettingsPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader title={m.shops.settingsTitle} subtitle={m.shops.settingsSubtitle} />
      <Suspense fallback={<Skeleton className="h-80 max-w-2xl" />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const actor = await requireAdminPage();
  const shop = await getShop(actor.shopId);
  if (!shop) return null; // the layout signs out logins whose shop is gone
  return (
    <Card className="max-w-2xl">
      <CardContent>
        <ShopDetailsForm shop={shop} action={updateOwnShop} />
      </CardContent>
    </Card>
  );
}
