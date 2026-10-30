import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePlatformAdmin } from "@/features/auth/session";
import { CreateShopForm } from "@/features/shops/components/create-shop-form";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "New shop" };

export default function NewShopPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.shops.addTitle}
        subtitle={m.shops.addSubtitle}
        back={<BackLink href="/platform" label={m.shops.title} />}
      />
      <Suspense fallback={<Skeleton className="h-[36rem] max-w-xl" />}>
        <PlatformOnlyForm />
      </Suspense>
    </>
  );
}

async function PlatformOnlyForm() {
  await requirePlatformAdmin();
  return <CreateShopForm />;
}
