import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { UnitDialog } from "@/features/items/components/unit-dialog";
import { listUnits } from "@/features/items/queries";
import { format, getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Units" };

export default function UnitsPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.units.title}
        subtitle={m.units.subtitle}
        back={<BackLink href="/items" label={m.items.title} />}
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <UnitsList />
      </Suspense>
    </>
  );
}

async function UnitsList() {
  const m = getMessages();
  const user = await requireUser();
  if (!can(user, "manageUnits")) redirect("/?denied=1");
  const units = await listUnits(user.shopId);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {units.map((unit) => (
          <li key={unit.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="flex flex-1 flex-col">
              <span className="text-lg font-semibold">
                {unit.label}{" "}
                <span className="font-normal text-muted-foreground">({unit.name})</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {unit.allowsDecimal ? m.units.decimals : m.units.wholeOnly} ·{" "}
                {format(m.units.itemsUsing, { count: unit.itemCount })}
              </span>
            </span>
            <UnitDialog unit={unit} />
          </li>
        ))}
      </ul>
      <div>
        <UnitDialog />
      </div>
    </div>
  );
}
