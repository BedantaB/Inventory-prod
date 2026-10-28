import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/features/auth/session";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";
import { RoleBadge, StatusBadge } from "@/features/users/components/user-badges";
import { UserStatusAction } from "@/features/users/components/user-status-action";
import { getUserById } from "@/features/users/queries";
import { getMessages } from "@/i18n";
import { BackToUsers } from "../back-link";

export const metadata: Metadata = { title: "Edit login" };

export default function EditUserPage({ params }: PageProps<"/users/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-2xl" />}>
      <EditUser params={params} />
    </Suspense>
  );
}

async function EditUser({ params }: Pick<PageProps<"/users/[id]">, "params">) {
  const m = getMessages();
  const actor = await requireAdminPage();
  const user = await getUserById((await params).id);
  if (!user) notFound();
  const isSelf = user.id === actor.id;

  return (
    <>
      <PageHeader title={user.fullName} subtitle={user.username} back={<BackToUsers />} />
      <div className="mb-6 flex gap-2">
        <RoleBadge role={user.role} m={m} />
        <StatusBadge isActive={user.isActive} m={m} />
      </div>
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{m.users.editTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <EditUserForm user={user} isSelf={isSelf} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ResetPasswordDialog user={user} />
          {!isSelf && <UserStatusAction user={user} />}
        </div>
      </div>
    </>
  );
}
