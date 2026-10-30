"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/form/form-field";
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
import { Textarea } from "@/components/ui/textarea";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { voidPaymentAction } from "../actions";
import { voidPaymentSchema } from "../schemas";

/** Owner: void a payment entered by mistake (it stays on record, marked Void). */
export function VoidPaymentDialog({
  customerId,
  paymentId,
  amount,
}: {
  customerId: string;
  paymentId: string;
  /** Already formatted, e.g. "₹500.00". */
  amount: string;
}) {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, errorFor, formProps } = useServerForm(
    voidPaymentAction.bind(null, customerId, paymentId),
    {
      schema: voidPaymentSchema,
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-destructive">
          {m.payments.void}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">{format(m.payments.voidTitle, { amount })}</DialogTitle>
          <DialogDescription className="text-base">{m.payments.voidBody}</DialogDescription>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-5">
          <FormField
            name="reason"
            label={m.payments.voidReason}
            error={errorFor("reason")}
            required
          >
            {(p) => (
              <Textarea {...p} rows={2} placeholder={m.payments.voidReasonPlaceholder} autoFocus />
            )}
          </FormField>
          <SubmitButton
            pending={pending}
            label={m.payments.voidConfirm}
            pendingLabel={m.common.saving}
            variant="destructive"
            className="w-full bg-destructive text-white hover:bg-destructive/90"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
