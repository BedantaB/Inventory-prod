import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { ItemForm } from "@/features/items/components/item-form";
import { listCategories, listUnits } from "@/features/items/queries";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "New item" };

export default function NewItemPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.items.addTitle}
        subtitle={m.items.addSubtitle}
        back={<BackLink href="/items" label={m.items.title} />}
      />
      <Suspense fallback={<Skeleton className="h-[32rem] max-w-2xl" />}>
        <NewItemForm />
      </Suspense>
    </>
  );
}

async function NewItemForm() {
  await requireUser();
  const [categories, units] = await Promise.all([listCategories(), listUnits()]);
  // Anyone may set the price on a new item; only the owner may change it afterwards.
  return <ItemForm categories={categories} units={units} canEditPrice />;
}
