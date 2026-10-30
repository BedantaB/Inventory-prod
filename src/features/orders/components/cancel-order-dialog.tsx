"use client";

import { BanIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
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
import { formatINR } from "@/lib/money";
import { cancelOrderAction } from "../actions";

const schema = z.object({
  reason: z.string().trim().min(1, { error: "orders.cancelReasonRequired" }),
});

/** Owner: cancel a completed order, with a reason. Stock goes back; the order stays on record. */
export function CancelOrderDialog({
  id,
  number,
  paidPaise,
}: {
  id: string;
  number: string;
  /** Paid with this order: it stays as the customer's credit after cancelling. */
  paidPaise: number;
}) {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, errorFor, formProps } = useServerForm(cancelOrderAction.bind(null, id), {
    schema,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-destructive text-destructive">
          <BanIcon aria-hidden />
          {m.orders.cancel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">{format(m.orders.cancelTitle, { number })}</DialogTitle>
          <DialogDescription className="text-base">{m.orders.cancelBody}</DialogDescription>
        </DialogHeader>
        {paidPaise > 0 && (
          <p className="rounded-lg border border-warning p-3 text-base">
            {format(m.payments.cancelWithPayment, { amount: formatINR(paidPaise) })}
          </p>
        )}
        <form {...formProps} className="flex flex-col gap-5">
          <FormField
            name="reason"
            label={m.orders.cancelReason}
            error={errorFor("reason")}
            required
          >
            {(p) => (
              <Textarea {...p} rows={2} placeholder={m.orders.cancelReasonPlaceholder} autoFocus />
            )}
          </FormField>
          <SubmitButton
            pending={pending}
            label={m.orders.cancelConfirm}
            pendingLabel={m.common.saving}
            variant="destructive"
            className="w-full bg-destructive text-white hover:bg-destructive/90"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
