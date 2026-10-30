"use client";

import { PowerIcon, PowerOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { setShopActiveAction } from "../actions";

export function ShopStatusAction({
  shop,
}: {
  shop: { id: string; name: string; isActive: boolean };
}) {
  const m = useMessages();
  const router = useRouter();
  const vars = { name: shop.name };

  if (!shop.isActive) {
    return (
      <ConfirmAction
        destructive={false}
        trigger={
          <Button size="lg" variant="outline">
            <PowerIcon aria-hidden />
            {m.shops.reactivate}
          </Button>
        }
        title={m.shops.reactivate}
        body={format(m.shops.reactivateBody, vars)}
        confirmLabel={m.shops.reactivate}
        action={() => setShopActiveAction(shop.id, true)}
        onDone={() => router.refresh()}
      />
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button size="lg" variant="destructive">
          <PowerOffIcon aria-hidden />
          {m.shops.deactivate}
        </Button>
      }
      title={format(m.shops.deactivateTitle, vars)}
      body={format(m.shops.deactivateBody, vars)}
      confirmLabel={m.shops.deactivate}
      action={() => setShopActiveAction(shop.id, false)}
      onDone={() => router.refresh()}
    />
  );
}
