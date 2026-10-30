"use client";

import { SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { useMessages } from "@/i18n/provider";
import type { ActionResult } from "@/lib/forms";
import { shopDetailsSchema } from "../schemas";
import { ShopDetailsFields } from "./shop-details-fields";

/** Edit a shop's name, address and phone: Shop settings (owner) and the platform's shop page. */
export function ShopDetailsForm({
  shop,
  action,
}: {
  shop: { name: string; address: string | null; phone: string | null };
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const m = useMessages();
  const router = useRouter();
  const { pending, errorFor, formProps } = useServerForm(action, {
    schema: shopDetailsSchema,
    onSuccess: () => router.refresh(),
  });

  return (
    <form {...formProps} className="flex max-w-xl flex-col gap-5">
      <ShopDetailsFields errorFor={errorFor} defaults={shop} />
      <SubmitButton
        pending={pending}
        label={m.common.save}
        pendingLabel={m.common.saving}
        icon={<SaveIcon aria-hidden />}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
