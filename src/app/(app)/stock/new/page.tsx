import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { StockInForm } from "@/features/inventory/components/stock-in-form";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Add Stock" };

export default function AddStockPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader title={m.stock.title} subtitle={m.stock.subtitle} />
      <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
        <SignedIn />
      </Suspense>
    </>
  );
}

async function SignedIn() {
  await requireUser();
  return <StockInForm />;
}
