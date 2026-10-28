"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { createUnitAction, updateUnitAction } from "../actions";
import { unitSchema } from "../schemas";

type Unit = { id: string; name: string; label: string; allowsDecimal: boolean };

/** Add a unit, or edit one (pass `unit`). */
export function UnitDialog({ unit }: { unit?: Unit }) {
  const m = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = unit ? updateUnitAction.bind(null, unit.id) : createUnitAction;
  const { pending, errorFor, formProps } = useServerForm(action, {
    schema: unitSchema,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        {unit ? (
          <Button variant="outline" aria-label={`${m.units.edit} ${unit.label}`}>
            <PencilIcon aria-hidden />
            <span className="max-sm:sr-only">{m.units.edit}</span>
          </Button>
        ) : (
          <Button size="lg">
            <PlusIcon aria-hidden />
            {m.units.add}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {unit ? `${m.units.edit}: ${unit.label}` : m.units.add}
          </DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-5">
          <FormField name="label" label={m.units.label} error={errorFor("label")} required>
            {(p) => (
              <Input
                {...p}
                defaultValue={unit?.label}
                placeholder={m.units.labelPlaceholder}
                autoFocus
              />
            )}
          </FormField>
          <FormField name="name" label={m.units.name} error={errorFor("name")} required>
            {(p) => (
              <Input
                {...p}
                defaultValue={unit?.name}
                placeholder={m.units.namePlaceholder}
                autoCapitalize="none"
                autoComplete="off"
              />
            )}
          </FormField>
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium">
              <input
                type="checkbox"
                name="allowsDecimal"
                defaultChecked={unit?.allowsDecimal}
                className="size-5 accent-primary"
              />
              {m.units.allowsDecimal}
            </label>
            <p className="text-sm text-muted-foreground">{m.units.allowsDecimalHint}</p>
            {errorFor("allowsDecimal") && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errorFor("allowsDecimal")}
              </p>
            )}
          </div>
          <SubmitButton
            pending={pending}
            label={m.common.save}
            pendingLabel={m.common.saving}
            className="w-full"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
