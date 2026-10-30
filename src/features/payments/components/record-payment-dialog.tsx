"use client";

import { IndianRupeeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/form/form-field";
import { FreshForm } from "@/components/form/fresh-form";
import { MoneyInput } from "@/components/form/money-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { recordPaymentAction } from "../actions";
import { PAYMENT_METHODS, paymentSchema } from "../schemas";

/** Record money received from a customer (staff and owner). */
export function RecordPaymentDialog({
  customer,
  today,
}: {
  customer: { id: string; name: string };
  /** Today in Indian time ("2026-10-30"): the default date, and the latest allowed. */
  today: string;
}) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          <IndianRupeeIcon aria-hidden />
          {m.payments.record}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {format(m.payments.recordTitle, { name: customer.name })}
          </DialogTitle>
          <DialogDescription className="text-base">{m.payments.recordBody}</DialogDescription>
        </DialogHeader>
        <FreshForm>
          {(onSaved) => (
            <PaymentForm
              customerId={customer.id}
              today={today}
              onSaved={() => {
                onSaved();
                setOpen(false);
              }}
            />
          )}
        </FreshForm>
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  customerId,
  today,
  onSaved,
}: {
  customerId: string;
  today: string;
  onSaved: () => void;
}) {
  const m = useMessages();
  const router = useRouter();
  const { pending, errorFor, formProps } = useServerForm(
    recordPaymentAction.bind(null, customerId),
    {
      schema: paymentSchema,
      onSuccess: () => {
        onSaved();
        router.refresh();
      },
    },
  );

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <FormField name="amount" label={m.payments.amount} error={errorFor("amount")} required>
        {(p) => <MoneyInput {...p} autoFocus />}
      </FormField>
      <fieldset
        className="flex flex-col gap-2"
        aria-invalid={errorFor("method") ? true : undefined}
      >
        <legend className="mb-1.5 text-base font-medium">{m.payments.method}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-3 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name="method"
                value={method}
                defaultChecked={method === "CASH"}
                className="size-5 accent-primary"
              />
              <span className="font-medium">{m.payments[`method${method}`]}</span>
            </label>
          ))}
        </div>
        {errorFor("method") && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorFor("method")}
          </p>
        )}
      </fieldset>
      <FormField name="receivedOn" label={m.payments.receivedOn} error={errorFor("receivedOn")}>
        {(p) => <Input {...p} type="date" defaultValue={today} max={today} />}
      </FormField>
      <FormField
        name="reference"
        label={m.payments.reference}
        hint={m.payments.referenceHint}
        optionalLabel={m.common.optional}
        error={errorFor("reference")}
      >
        {(p) => <Input {...p} autoComplete="off" />}
      </FormField>
      <FormField
        name="note"
        label={m.payments.note}
        optionalLabel={m.common.optional}
        error={errorFor("note")}
      >
        {(p) => <Textarea {...p} rows={2} />}
      </FormField>
      <SubmitButton
        pending={pending}
        label={m.payments.save}
        pendingLabel={m.common.saving}
        className="w-full"
      />
    </form>
  );
}
