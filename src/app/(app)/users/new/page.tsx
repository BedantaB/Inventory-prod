import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/features/auth/session";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { getMessages } from "@/i18n";
import { BackLink } from "@/components/back-link";

export const metadata: Metadata = { title: "New staff login" };

export default function NewUserPage() {
  const m = getMessages();
  return (
    <>
      <PageHeader
        title={m.users.addTitle}
        subtitle={m.users.addSubtitle}
        back={<BackLink href="/users" label={m.users.title} />}
      />
      <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
        <AdminOnlyForm />
      </Suspense>
    </>
  );
}

async function AdminOnlyForm() {
  await requireAdminPage();
  return <CreateUserForm />;
}
