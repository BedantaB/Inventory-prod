"use client";

import { PlusIcon } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useMessages } from "@/i18n/provider";
import type { ActionResult } from "@/lib/forms";
import { categorySchema } from "../schemas";

type Option = { id: string; name: string };

/**
 * A dropdown of named things (categories, brands) with a "+" button to add a new one
 * without leaving the item form.
 */
export function LookupField({
  name,
  label,
  emptyLabel,
  options: initialOptions,
  defaultValue,
  error,
  create,
  text,
}: {
  name: string;
  label: string;
  emptyLabel: string;
  options: Option[];
  defaultValue: string | null;
  error?: string;
  create: (formData: FormData) => Promise<ActionResult<Option>>;
  text: { add: string; title: string; fieldLabel: string; placeholder: string };
}) {
  const m = useMessages();
  const [options, setOptions] = useState(initialOptions);
  const [value, setValue] = useState(defaultValue ?? "");

  const onCreated = (option: Option) => {
    setOptions((prev) =>
      prev.some((o) => o.id === option.id)
        ? prev
        : [...prev, option].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setValue(option.id);
  };

  return (
    <FormField name={name} label={label} optionalLabel={m.common.optional} error={error}>
      {(p) => (
        <div className="flex gap-2">
          <NativeSelect
            {...p}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1"
          >
            <option value="">{emptyLabel}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
          <AddDialog create={create} onCreated={onCreated} text={text} />
        </div>
      )}
    </FormField>
  );
}

function AddDialog({
  create,
  onCreated,
  text,
}: {
  create: (formData: FormData) => Promise<ActionResult<Option>>;
  onCreated: (option: Option) => void;
  text: { add: string; title: string; fieldLabel: string; placeholder: string };
}) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const { pending, errorFor, formProps } = useServerForm(create, {
    schema: categorySchema,
    onSuccess: (result) => {
      if (result.data) onCreated(result.data);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" aria-label={text.add}>
          <PlusIcon aria-hidden />
          <span className="max-sm:sr-only">{text.add}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">{text.title}</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-5">
          <FormField name="name" label={text.fieldLabel} error={errorFor("name")} required>
            {(p) => <Input {...p} placeholder={text.placeholder} autoComplete="off" autoFocus />}
          </FormField>
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
