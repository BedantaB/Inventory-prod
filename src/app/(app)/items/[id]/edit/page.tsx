import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { ItemForm } from "@/features/items/components/item-form";
import { getItem, listCategories, listUnits } from "@/features/items/queries";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Edit item" };

export default function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] max-w-2xl" />}>
      <EditItem params={params} />
    </Suspense>
  );
}

async function EditItem({ params }: Pick<PageProps<"/items/[id]/edit">, "params">) {
  const m = getMessages();
  const user = await requireUser();
  const { id } = await params;
  const [item, categories, units] = await Promise.all([getItem(id), listCategories(), listUnits()]);
  if (!item) notFound();
  if (item.archivedAt) redirect(`/items/${item.id}`);

  return (
    <>
      <PageHeader
        title={m.items.editTitle}
        subtitle={item.name}
        back={<BackLink href={`/items/${item.id}`} label={item.name} />}
      />
      <ItemForm
        item={item}
        categories={categories}
        units={units}
        canEditPrice={can(user, "editItemPrice")}
      />
    </>
  );
}
