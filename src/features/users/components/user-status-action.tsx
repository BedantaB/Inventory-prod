"use client";

import { UserCheckIcon, UserXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { setUserActive } from "../actions";
import type { UserRow } from "../queries";

export function UserStatusAction({ user }: { user: UserRow }) {
  const m = useMessages();
  const router = useRouter();
  const vars = { name: user.fullName };

  if (!user.isActive) {
    return (
      <ConfirmAction
        destructive={false}
        trigger={
          <Button size="lg" variant="outline">
            <UserCheckIcon aria-hidden />
            {m.users.reactivate}
          </Button>
        }
        title={m.users.reactivate}
        body={format(m.users.reactivateBody, vars)}
        confirmLabel={m.users.reactivate}
        action={() => setUserActive(user.id, true)}
        onDone={() => router.refresh()}
      />
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button size="lg" variant="destructive">
          <UserXIcon aria-hidden />
          {m.users.deactivate}
        </Button>
      }
      title={format(m.users.deactivateTitle, vars)}
      body={format(m.users.deactivateBody, vars)}
      confirmLabel={m.users.deactivate}
      action={() => setUserActive(user.id, false)}
      onDone={() => router.refresh()}
    />
  );
}
