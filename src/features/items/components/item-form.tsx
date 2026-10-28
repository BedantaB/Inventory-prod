"use client";

import { SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { MoneyInput } from "@/components/form/money-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useMessages } from "@/i18n/provider";
import { paiseToInput } from "@/lib/money";
import { qtyToInput } from "@/lib/qty";
import { createItemAction, updateItemAction } from "../actions";
import type { ItemView } from "../data";
import { itemSchema } from "../schemas";
import { CategoryField } from "./category-field";
import { PhotoPicker, type PickedPhoto } from "./photo-picker";

type Unit = { id: string; name: string; label: string; allowsDecimal: boolean };

export function ItemForm({
  item,
  categories,
  units,
  canEditPrice,
}: {
  /** Absent when creating a new item. */
  item?: ItemView;
  categories: { id: string; name: string }[];
  units: Unit[];
  canEditPrice: boolean;
}) {
  const m = useMessages();
  const router = useRouter();
  const photo = useRef<PickedPhoto>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const defaultUnitId = item?.unitId ?? units.find((u) => u.name === "pcs")?.id ?? units[0]?.id;
  const [unitId, setUnitId] = useState(defaultUnitId);
  const allowsDecimal = units.find((u) => u.id === unitId)?.allowsDecimal ?? false;
  const priceLocked = Boolean(item) && !canEditPrice;

  const action = item ? updateItemAction.bind(null, item.id) : createItemAction;
  const { pending, errorFor, formProps } = useServerForm<{ id: string } | undefined>(action, {
    schema: itemSchema,
    prepareFormData: (formData) => {
      if (photo.current) {
        formData.set("photo", new File([photo.current.full], "photo.jpg", { type: "image/jpeg" }));
        formData.set(
          "photoThumb",
          new File([photo.current.thumb], "thumb.jpg", { type: "image/jpeg" }),
        );
      }
    },
    onSuccess: (result) => {
      const id = item?.id ?? result.data?.id;
      router.push(id ? `/items/${id}` : "/items");
    },
  });

  return (
    <form {...formProps} className="flex max-w-2xl flex-col gap-5">
      <FormField name="name" label={m.items.name} error={errorFor("name")} required>
        {(p) => (
          <Input
            {...p}
            defaultValue={item?.name}
            placeholder={m.items.namePlaceholder}
            autoComplete="off"
            autoFocus={!item}
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="unitId"
          label={m.items.unit}
          hint={m.items.unitHint}
          error={errorFor("unitId")}
          required
        >
          {(p) => (
            <NativeSelect {...p} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} ({u.name})
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          name="packSize"
          label={m.items.packSize}
          optionalLabel={m.common.optional}
          error={errorFor("packSize")}
        >
          {(p) => (
            <Input
              {...p}
              defaultValue={item?.packSize ?? ""}
              placeholder={m.items.packSizePlaceholder}
            />
          )}
        </FormField>
      </div>

      <CategoryField
        categories={categories}
        defaultValue={item?.categoryId ?? null}
        error={errorFor("categoryId")}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="sellingPrice"
          label={m.items.sellingPrice}
          optionalLabel={m.common.optional}
          hint={priceLocked ? m.items.priceOwnerOnly : m.items.sellingPriceHint}
          error={errorFor("sellingPrice")}
        >
          {(p) => (
            <MoneyInput
              {...p}
              defaultValue={
                item?.sellingPricePaise != null ? paiseToInput(item.sellingPricePaise) : ""
              }
              placeholder="0.00"
              disabled={priceLocked}
            />
          )}
        </FormField>
        <FormField
          name="lowStockThreshold"
          label={m.items.lowStock}
          hint={m.items.lowStockHint}
          error={errorFor("lowStockThreshold")}
        >
          {(p) => (
            <Input
              {...p}
              defaultValue={item ? qtyToInput(item.lowStockMilli) : "0"}
              inputMode={allowsDecimal ? "decimal" : "numeric"}
              autoComplete="off"
            />
          )}
        </FormField>
      </div>

      <FormField
        name="sku"
        label={m.items.sku}
        optionalLabel={m.common.optional}
        hint={m.items.skuHint}
        error={errorFor("sku")}
      >
        {(p) => (
          <Input
            {...p}
            defaultValue={item?.sku ?? ""}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>

      <PhotoPicker
        existingPath={item?.photoPath ?? null}
        error={errorFor("photo")}
        onChange={(picked, removeExisting) => {
          photo.current = picked;
          setRemovePhoto(removeExisting);
        }}
      />
      <input type="hidden" name="removePhoto" value={removePhoto ? "true" : ""} />

      <SubmitButton
        pending={pending}
        label={item ? m.common.save : m.items.add}
        pendingLabel={m.common.saving}
        icon={<SaveIcon aria-hidden />}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
