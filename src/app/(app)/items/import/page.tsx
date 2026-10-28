import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { ImportItems } from "@/features/items/components/import-items";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Import items" };

export default function ImportItemsPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.import.title}
        subtitle={m.import.subtitle}
        back={<BackLink href="/items" label={m.items.title} />}
      />
      <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
        <OwnerOnly />
      </Suspense>
    </>
  );
}

async function OwnerOnly() {
  const user = await requireUser();
  if (!can(user, "importItems")) redirect("/?denied=1");
  return <ImportItems />;
}
