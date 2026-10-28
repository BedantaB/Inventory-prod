"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { setOrderArchivedAction } from "../actions";

export function OrderArchiveAction({
  id,
  number,
  archived,
}: {
  id: string;
  number: string;
  archived: boolean;
}) {
  const m = useMessages();
  const router = useRouter();
  return archived ? (
    <ConfirmAction
      destructive={false}
      trigger={
        <Button variant="outline">
          <ArchiveRestoreIcon aria-hidden />
          {m.orders.unarchive}
        </Button>
      }
      title={format(m.orders.unarchiveTitle, { number })}
      body={m.orders.unarchiveBody}
      confirmLabel={m.orders.unarchive}
      action={() => setOrderArchivedAction(id, false)}
      onDone={() => router.refresh()}
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive">
          <ArchiveIcon aria-hidden />
          {m.orders.archive}
        </Button>
      }
      title={format(m.orders.archiveTitle, { number })}
      body={m.orders.archiveBody}
      confirmLabel={m.orders.archive}
      action={() => setOrderArchivedAction(id, true)}
      onDone={() => router.refresh()}
    />
  );
}
