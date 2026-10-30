"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form/form-field";
import { FreshForm } from "@/components/form/fresh-form";
import { PasswordInput } from "@/components/form/password-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { createShopAction } from "../actions";
import { createShopSchema } from "../schemas";
import { ShopDetailsFields } from "./shop-details-fields";

export function CreateShopForm() {
  return <FreshForm>{(onSaved) => <CreateShopFormBody onSaved={onSaved} />}</FreshForm>;
}

function CreateShopFormBody({ onSaved }: { onSaved: () => void }) {
  const m = useMessages();
  const router = useRouter();
  const { pending, errorFor, formProps } = useServerForm(createShopAction, {
    schema: createShopSchema,
    onSuccess: (result) => {
      router.push(result.data ? `/platform/shops/${result.data.id}` : "/platform");
      onSaved();
    },
  });

  return (
    <form {...formProps} className="flex max-w-xl flex-col gap-5">
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 text-lg font-semibold">{m.shops.shopSection}</legend>
        <ShopDetailsFields errorFor={errorFor} autoFocus />
      </fieldset>
      <fieldset className="flex flex-col gap-5 border-t pt-5">
        <legend className="mb-1 text-lg font-semibold">{m.shops.ownerSection}</legend>
        <p className="-mt-3 text-sm text-muted-foreground">{m.shops.ownerSectionHint}</p>
        <FormField name="fullName" label={m.users.fullName} error={errorFor("fullName")} required>
          {(p) => <Input {...p} autoComplete="off" />}
        </FormField>
        <FormField
          name="username"
          label={m.users.username}
          hint={m.users.usernameHint}
          error={errorFor("username")}
          required
        >
          {(p) => (
            <Input
              {...p}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </FormField>
        <FormField
          name="password"
          label={m.users.password}
          hint={m.shops.passwordHint}
          error={errorFor("password")}
          required
        >
          {(p) => <PasswordInput {...p} autoComplete="new-password" />}
        </FormField>
      </fieldset>
      <SubmitButton
        pending={pending}
        label={m.shops.add}
        pendingLabel={m.common.saving}
        icon={<PlusIcon aria-hidden />}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
