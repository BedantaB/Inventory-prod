"use client";

import { SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { FreshForm } from "@/components/form/fresh-form";
import { MoneyInput } from "@/components/form/money-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useMessages } from "@/i18n/provider";
import { paiseToInput } from "@/lib/money";
import { qtyToInput } from "@/lib/qty";
import {
  createBrandAction,
  createCategoryAction,
  createItemAction,
  updateItemAction,
} from "../actions";
import type { ItemView } from "../data";
import { itemSchema } from "../schemas";
import { LookupField } from "./lookup-field";
import { PhotoPicker, type PickedPhoto } from "./photo-picker";

type Unit = { id: string; name: string; label: string; allowsDecimal: boolean };
type Option = { id: string; name: string };

const money = (paise: number | null | undefined) => (paise != null ? paiseToInput(paise) : "");

type ItemFormProps = {
  /** The item being edited. Absent when creating. */
  item?: ItemView;
  /** "Add another colour": a new item that starts as a copy of this one. */
  copyFrom?: ItemView;
  categories: Option[];
  brands: Option[];
  units: Unit[];
  canEditPrice: boolean;
};

export function ItemForm(props: ItemFormProps) {
  // Editing keeps what was typed; adding starts fresh after each save.
  if (props.item) return <ItemFormBody {...props} />;
  return <FreshForm>{(onSaved) => <ItemFormBody {...props} onSaved={onSaved} />}</FreshForm>;
}

function ItemFormBody({
  item,
  copyFrom,
  categories,
  brands,
  units,
  canEditPrice,
  onSaved,
}: ItemFormProps & { onSaved?: () => void }) {
  const m = useMessages();
  const router = useRouter();
  const photo = useRef<PickedPhoto>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const base = item ?? copyFrom;
  const defaultUnitId = base?.unitId ?? units.find((u) => u.name === "pcs")?.id ?? units[0]?.id;
  const [unitId, setUnitId] = useState(defaultUnitId);
  const allowsDecimal = units.find((u) => u.id === unitId)?.allowsDecimal ?? false;
  const priceLocked = Boolean(item) && !canEditPrice;

  // "Add another colour": put the cursor in the colour box. (autoFocus doesn't fire after an
  // in-app navigation, so focus it once the page is shown.)
  const variantRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!copyFrom) return;
    const frame = requestAnimationFrame(() => variantRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [copyFrom]);

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
      onSaved?.();
    },
  });

  return (
    <form {...formProps} className="flex max-w-2xl flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <FormField name="name" label={m.items.name} error={errorFor("name")} required>
          {(p) => (
            <Input
              {...p}
              defaultValue={base?.name}
              placeholder={m.items.namePlaceholder}
              autoComplete="off"
              autoFocus={!base}
            />
          )}
        </FormField>
        <FormField
          name="variant"
          label={m.items.variant}
          optionalLabel={m.common.optional}
          error={errorFor("variant")}
        >
          {(p) => (
            <Input
              {...p}
              // A copy needs a new colour, so it starts empty.
              defaultValue={item?.variant ?? ""}
              placeholder={m.items.variantPlaceholder}
              autoComplete="off"
              ref={variantRef}
            />
          )}
        </FormField>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">{m.items.variantHint}</p>

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
              defaultValue={base?.packSize ?? ""}
              placeholder={m.items.packSizePlaceholder}
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <LookupField
          name="brandId"
          label={m.items.brand}
          emptyLabel={m.items.noBrand}
          options={brands}
          defaultValue={base?.brandId ?? null}
          error={errorFor("brandId")}
          create={createBrandAction}
          text={{
            add: m.items.newBrand,
            title: m.items.newBrandTitle,
            fieldLabel: m.items.newBrandName,
            placeholder: m.items.newBrandPlaceholder,
          }}
        />
        <LookupField
          name="categoryId"
          label={m.items.category}
          emptyLabel={m.items.noCategory}
          options={categories}
          defaultValue={base?.categoryId ?? null}
          error={errorFor("categoryId")}
          create={createCategoryAction}
          text={{
            add: m.items.newCategory,
            title: m.items.newCategoryTitle,
            fieldLabel: m.items.newCategoryName,
            placeholder: m.items.newCategoryPlaceholder,
          }}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="mrp"
          label={m.items.mrp}
          optionalLabel={m.common.optional}
          hint={priceLocked ? m.items.priceOwnerOnly : m.items.mrpHint}
          error={errorFor("mrp")}
        >
          {(p) => (
            <MoneyInput
              {...p}
              defaultValue={money(base?.mrpPaise)}
              placeholder="0.00"
              disabled={priceLocked}
            />
          )}
        </FormField>
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
              defaultValue={money(base?.sellingPricePaise)}
              placeholder="0.00"
              disabled={priceLocked}
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="lowStockThreshold"
          label={m.items.lowStock}
          hint={m.items.lowStockHint}
          error={errorFor("lowStockThreshold")}
        >
          {(p) => (
            <Input
              {...p}
              defaultValue={base ? qtyToInput(base.lowStockMilli) : "0"}
              inputMode={allowsDecimal ? "decimal" : "numeric"}
              autoComplete="off"
            />
          )}
        </FormField>
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
              // A copy gets its own SKU.
              defaultValue={item?.sku ?? ""}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </FormField>
      </div>

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
