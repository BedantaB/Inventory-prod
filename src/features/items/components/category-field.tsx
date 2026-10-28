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
import { createCategoryAction } from "../actions";
import { categorySchema } from "../schemas";

type Category = { id: string; name: string };

/** Category dropdown with a "+ New category" button, so nobody has to leave the item form. */
export function CategoryField({
  categories,
  defaultValue,
  error,
}: {
  categories: Category[];
  defaultValue: string | null;
  error?: string;
}) {
  const m = useMessages();
  const [options, setOptions] = useState(categories);
  const [value, setValue] = useState(defaultValue ?? "");

  const onCreated = (category: Category) => {
    setOptions((prev) =>
      prev.some((c) => c.id === category.id)
        ? prev
        : [...prev, category].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setValue(category.id);
  };

  return (
    <FormField
      name="categoryId"
      label={m.items.category}
      optionalLabel={m.common.optional}
      error={error}
    >
      {(p) => (
        <div className="flex gap-2">
          <NativeSelect
            {...p}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1"
          >
            <option value="">{m.items.noCategory}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <NewCategoryDialog onCreated={onCreated} />
        </div>
      )}
    </FormField>
  );
}

function NewCategoryDialog({ onCreated }: { onCreated: (category: Category) => void }) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const { pending, errorFor, formProps } = useServerForm(createCategoryAction, {
    schema: categorySchema,
    onSuccess: (result) => {
      if (result.data) onCreated(result.data);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <PlusIcon aria-hidden />
          <span className="max-sm:sr-only">{m.items.newCategory}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">{m.items.newCategoryTitle}</DialogTitle>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-5">
          <FormField name="name" label={m.items.newCategoryName} error={errorFor("name")} required>
            {(p) => (
              <Input
                {...p}
                placeholder={m.items.newCategoryPlaceholder}
                autoComplete="off"
                autoFocus
              />
            )}
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
