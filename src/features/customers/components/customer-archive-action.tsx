"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { setCustomerArchivedAction } from "../actions";

export function CustomerArchiveAction({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const m = useMessages();
  const router = useRouter();
  return archived ? (
    <ConfirmAction
      destructive={false}
      trigger={
        <Button size="lg" variant="outline">
          <ArchiveRestoreIcon aria-hidden />
          {m.customers.unarchive}
        </Button>
      }
      title={format(m.customers.unarchiveTitle, { name })}
      body={m.customers.unarchiveBody}
      confirmLabel={m.customers.unarchive}
      action={() => setCustomerArchivedAction(id, false)}
      onDone={() => router.refresh()}
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button size="lg" variant="destructive">
          <ArchiveIcon aria-hidden />
          {m.customers.archive}
        </Button>
      }
      title={format(m.customers.archiveTitle, { name })}
      body={m.customers.archiveBody}
      confirmLabel={m.customers.archive}
      action={() => setCustomerArchivedAction(id, true)}
      onDone={() => router.refresh()}
    />
  );
}
