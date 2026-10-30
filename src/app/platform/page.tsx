import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/features/auth/session";
import { ShopsList } from "@/features/shops/components/shops-list";
import { listShops } from "@/features/shops/queries";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Shops" };

export default function ShopsPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.shops.title}
        subtitle={m.shops.subtitle}
        action={
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/platform/shops/new">
              <PlusIcon aria-hidden />
              {m.shops.add}
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <Shops />
      </Suspense>
    </>
  );
}

async function Shops() {
  await requirePlatformAdmin();
  return <ShopsList shops={await listShops()} m={getMessages()} />;
}
