import { ConstructionIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getMessages } from "@/i18n";

/** Placeholder for screens built in later phases. */
export function ComingSoon({ title }: { title: string }) {
  const m = getMessages();
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={ConstructionIcon}
        title={m.common.comingSoon}
        body={m.common.comingSoonBody}
      />
    </>
  );
}
