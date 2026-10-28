import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { CustomerEditor } from "@/features/customers/components/customer-editor";
import { getMessages } from "@/i18n";

export const metadata: Metadata = { title: "New customer" };

export default function NewCustomerPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.customers.addTitle}
        subtitle={m.customers.addSubtitle}
        back={<BackLink href="/customers" label={m.customers.title} />}
      />
      <Suspense fallback={<Skeleton className="h-[28rem] max-w-2xl" />}>
        <SignedIn />
      </Suspense>
    </>
  );
}

async function SignedIn() {
  await requireUser();
  return <CustomerEditor />;
}
