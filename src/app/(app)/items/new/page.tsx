import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { ItemForm } from "@/features/items/components/item-form";
import { itemDisplayName } from "@/features/items/data";
import { getItem, listBrands, listCategories, listUnits } from "@/features/items/queries";
import { format, getMessages } from "@/i18n";
import { firstParam } from "@/lib/list-params";

export const metadata: Metadata = { title: "New item" };

export default function NewItemPage({ searchParams }: PageProps<"/items/new">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] max-w-2xl" />}>
      <NewItem searchParams={searchParams} />
    </Suspense>
  );
}

async function NewItem({ searchParams }: Pick<PageProps<"/items/new">, "searchParams">) {
  const m = getMessages();
  await requireUser();
  const copyId = firstParam((await searchParams).copy);
  const [categories, brands, units, copyFrom] = await Promise.all([
    listCategories(),
    listBrands(),
    listUnits(),
    copyId ? getItem(copyId) : null,
  ]);

  return (
    <>
      <PageHeader
        title={
          copyFrom ? format(m.items.addVariantTitle, { name: copyFrom.name }) : m.items.addTitle
        }
        subtitle={
          copyFrom
            ? format(m.items.addVariantSubtitle, { name: itemDisplayName(copyFrom) })
            : m.items.addSubtitle
        }
        back={
          copyFrom ? (
            <BackLink href={`/items/${copyFrom.id}`} label={itemDisplayName(copyFrom)} />
          ) : (
            <BackLink href="/items" label={m.items.title} />
          )
        }
      />
      {/* Anyone may set prices on a new item; only the owner may change them afterwards. */}
      <ItemForm
        copyFrom={copyFrom ?? undefined}
        categories={categories}
        brands={brands}
        units={units}
        canEditPrice
      />
    </>
  );
}
