"use client";

import { ClipboardCheckIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { formatQty, parseQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import { correctStockAction } from "../actions";
import { ADJUST_REASONS, correctStockSchema } from "../schemas";

type Item = {
  id: string;
  name: string;
  stockMilli: number;
  unitName: string;
  allowsDecimal: boolean;
};

/** Owner: set the stock to what was counted, with a reason (saved as one ADJUST movement). */
export function CorrectStockDialog({ item }: { item: Item }) {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const { pending, errorFor, formProps } = useServerForm(correctStockAction.bind(null, item.id), {
    schema: correctStockSchema,
    onSuccess: () => {
      setOpen(false);
      setCounted("");
      router.refresh();
    },
  });

  const countedMilli = parseQty(counted, { allowDecimal: item.allowsDecimal });
  const change = countedMilli === null ? null : countedMilli - item.stockMilli;
  const unit = item.unitName;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardCheckIcon aria-hidden />
          {m.stock.correct}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {format(m.stock.correctTitle, { name: item.name })}
          </DialogTitle>
          <DialogDescription className="text-base">{m.stock.correctBody}</DialogDescription>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-5">
          <p className="text-base font-medium">
            {format(m.stock.correctNow, { stock: `${formatQty(item.stockMilli)} ${unit}` })}
          </p>
          <FormField
            name="counted"
            label={format(m.stock.counted, { unit })}
            hint={m.stock.countedHint}
            error={errorFor("counted")}
            required
          >
            {(p) => (
              <Input
                {...p}
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                inputMode={item.allowsDecimal ? "decimal" : "numeric"}
                autoComplete="off"
                autoFocus
              />
            )}
          </FormField>
          {change !== null && change !== 0 && (
            <p
              className={cn(
                "-mt-3 text-base font-semibold",
                change > 0 ? "text-success" : "text-destructive",
              )}
              aria-live="polite"
            >
              {format(m.stock.change, {
                change: `${change > 0 ? "+" : "−"}${formatQty(Math.abs(change))} ${unit}`,
              })}
            </p>
          )}

          <fieldset
            className="flex flex-col gap-2"
            aria-invalid={errorFor("reason") ? true : undefined}
          >
            <legend className="mb-1.5 text-base font-medium">{m.stock.reason}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ADJUST_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-3 has-focus-visible:outline-ring"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    className="size-5 accent-primary"
                  />
                  <span className="font-medium">{m.stock[`reason${reason}`]}</span>
                </label>
              ))}
            </div>
            {errorFor("reason") && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errorFor("reason")}
              </p>
            )}
          </fieldset>

          <FormField
            name="note"
            label={m.stock.reasonNote}
            hint={m.stock.reasonNoteHint}
            error={errorFor("note")}
          >
            {(p) => <Textarea {...p} rows={2} />}
          </FormField>
          <SubmitButton
            pending={pending}
            label={m.stock.saveCorrection}
            pendingLabel={m.common.saving}
            className="w-full"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
