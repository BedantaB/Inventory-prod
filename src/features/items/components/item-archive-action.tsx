"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { setItemArchivedAction } from "../actions";

export function ItemArchiveAction({
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
          {m.items.unarchive}
        </Button>
      }
      title={format(m.items.unarchiveTitle, { name })}
      body={m.items.unarchiveBody}
      confirmLabel={m.items.unarchive}
      action={() => setItemArchivedAction(id, false)}
      onDone={() => router.refresh()}
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button size="lg" variant="destructive">
          <ArchiveIcon aria-hidden />
          {m.items.archive}
        </Button>
      }
      title={format(m.items.archiveTitle, { name })}
      body={m.items.archiveBody}
      confirmLabel={m.items.archive}
      action={() => setItemArchivedAction(id, true)}
      onDone={() => router.refresh()}
    />
  );
}
