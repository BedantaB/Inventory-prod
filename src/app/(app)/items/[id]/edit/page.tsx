import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { ItemForm } from "@/features/items/components/item-form";
import { itemDisplayName } from "@/features/items/data";
import { getItem, listBrands, listCategories, listUnits } from "@/features/items/queries";
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
  const [item, categories, brands, units] = await Promise.all([
    getItem(user.shopId, id),
    listCategories(user.shopId),
    listBrands(user.shopId),
    listUnits(user.shopId),
  ]);
  if (!item) notFound();
  if (item.archivedAt) redirect(`/items/${item.id}`);

  return (
    <>
      <PageHeader
        title={m.items.editTitle}
        subtitle={itemDisplayName(item)}
        back={<BackLink href={`/items/${item.id}`} label={itemDisplayName(item)} />}
      />
      <ItemForm
        item={item}
        categories={categories}
        brands={brands}
        units={units}
        canEditPrice={can(user, "editItemPrice")}
      />
    </>
  );
}
