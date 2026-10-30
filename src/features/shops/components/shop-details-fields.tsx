"use client";

import { FormField } from "@/components/form/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/i18n/provider";

type Defaults = { name: string; address: string | null; phone: string | null };

/** Name, address and phone inputs, shared by the create and edit forms. */
export function ShopDetailsFields({
  errorFor,
  defaults,
  autoFocus = false,
}: {
  errorFor: (name: string) => string | undefined;
  defaults?: Defaults;
  autoFocus?: boolean;
}) {
  const m = useMessages();
  return (
    <>
      <FormField name="name" label={m.shops.name} error={errorFor("name")} required>
        {(p) => (
          <Input
            {...p}
            defaultValue={defaults?.name}
            placeholder={m.shops.namePlaceholder}
            autoComplete="off"
            autoFocus={autoFocus}
          />
        )}
      </FormField>
      <FormField name="address" label={m.shops.address} error={errorFor("address")}>
        {(p) => <Textarea {...p} defaultValue={defaults?.address ?? ""} rows={2} />}
      </FormField>
      <FormField name="phone" label={m.shops.phone} error={errorFor("phone")}>
        {(p) => (
          <Input
            {...p}
            defaultValue={defaults?.phone ?? ""}
            type="tel"
            inputMode="tel"
            autoComplete="off"
          />
        )}
      </FormField>
    </>
  );
}
