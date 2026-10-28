"use client";

import { SaveIcon } from "lucide-react";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/i18n/provider";
import { formatPhone } from "@/lib/phone";
import { createCustomerAction, updateCustomerAction, type SavedCustomer } from "../actions";
import type { CustomerView } from "../data";
import { customerSchema } from "../schemas";

/**
 * Add or edit a customer. `onSaved` receives the new customer's id and name
 * (also used later by the quick "add customer" in New Order).
 */
export function CustomerForm({
  customer,
  onSaved,
  compact = false,
}: {
  customer?: CustomerView;
  onSaved: (saved: SavedCustomer) => void;
  /** Only the essential fields (for quick add). */
  compact?: boolean;
}) {
  const m = useMessages();
  const action = customer ? updateCustomerAction.bind(null, customer.id) : createCustomerAction;
  const { pending, errorFor, formProps } = useServerForm<SavedCustomer | undefined>(action, {
    schema: customerSchema,
    onSuccess: (result) => {
      if (customer) onSaved(customer);
      else if (result.data) onSaved(result.data);
    },
  });

  return (
    <form {...formProps} className="flex max-w-2xl flex-col gap-5">
      <FormField
        name="businessName"
        label={m.customers.businessName}
        error={errorFor("businessName")}
        required
      >
        {(p) => (
          <Input
            {...p}
            defaultValue={customer?.businessName}
            placeholder={m.customers.businessNamePlaceholder}
            autoComplete="organization"
            autoFocus={!customer}
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="phone"
          label={m.customers.phone}
          hint={m.customers.phoneHint}
          error={errorFor("phone")}
          required
        >
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={customer ? formatPhone(customer.phone) : ""}
              placeholder={m.customers.phonePlaceholder}
            />
          )}
        </FormField>
        <FormField
          name="contactPerson"
          label={m.customers.contactPerson}
          optionalLabel={m.common.optional}
          error={errorFor("contactPerson")}
        >
          {(p) => (
            <Input
              {...p}
              defaultValue={customer?.contactPerson ?? ""}
              placeholder={m.customers.contactPersonPlaceholder}
              autoComplete="name"
            />
          )}
        </FormField>
      </div>

      <FormField
        name="city"
        label={m.customers.city}
        optionalLabel={m.common.optional}
        error={errorFor("city")}
      >
        {(p) => (
          <Input
            {...p}
            defaultValue={customer?.city ?? ""}
            placeholder={m.customers.cityPlaceholder}
            autoComplete="address-level2"
          />
        )}
      </FormField>

      {!compact && (
        <>
          <FormField
            name="address"
            label={m.customers.address}
            optionalLabel={m.common.optional}
            error={errorFor("address")}
          >
            {(p) => (
              <Input
                {...p}
                defaultValue={customer?.address ?? ""}
                placeholder={m.customers.addressPlaceholder}
                autoComplete="street-address"
              />
            )}
          </FormField>
          <FormField
            name="email"
            label={m.customers.email}
            optionalLabel={m.common.optional}
            error={errorFor("email")}
          >
            {(p) => (
              <Input
                {...p}
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={customer?.email ?? ""}
                placeholder="name@example.com"
              />
            )}
          </FormField>
          <FormField
            name="notes"
            label={m.customers.notes}
            optionalLabel={m.common.optional}
            error={errorFor("notes")}
          >
            {(p) => (
              <Textarea
                {...p}
                defaultValue={customer?.notes ?? ""}
                placeholder={m.customers.notesPlaceholder}
                rows={3}
              />
            )}
          </FormField>
        </>
      )}

      <SubmitButton
        pending={pending}
        label={customer ? m.common.save : m.customers.add}
        pendingLabel={m.common.saving}
        icon={<SaveIcon aria-hidden />}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
