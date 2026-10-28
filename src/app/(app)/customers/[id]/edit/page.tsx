import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { CustomerEditor } from "@/features/customers/components/customer-editor";
import { getCustomer } from "@/features/customers/queries";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "Edit customer" };

export default function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-[28rem] max-w-2xl" />}>
      <EditCustomer params={params} />
    </Suspense>
  );
}

async function EditCustomer({ params }: Pick<PageProps<"/customers/[id]/edit">, "params">) {
  const m = getMessages();
  await requireUser();
  const customer = await getCustomer((await params).id);
  if (!customer) notFound();
  if (customer.archivedAt) redirect(`/customers/${customer.id}`);
  return (
    <>
      <PageHeader
        title={m.customers.editTitle}
        subtitle={customer.businessName}
        back={<BackLink href={`/customers/${customer.id}`} label={customer.businessName} />}
      />
      <CustomerEditor customer={customer} />
    </>
  );
}
