"use client";

import { XIcon } from "lucide-react";
import { useRef } from "react";
import { SearchCombobox } from "@/components/search-combobox";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { formatQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import { searchItemsAction, type PickerItem } from "../actions";
import { ItemPhoto } from "./item-photo";

/** One search result: photo, name with colour, pack · brand · SKU, and stock. */
export function ItemOption({ item }: { item: PickerItem }) {
  return (
    <>
      <ItemPhoto path={item.photoPath} alt="" className="size-10" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 font-medium break-words">{item.label}</span>
        <span className="truncate text-sm text-muted-foreground">
          {[item.packSize, item.brandName, item.sku].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-sm whitespace-nowrap",
          item.stockMilli <= 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {formatQty(item.stockMilli)} {item.unitName}
      </span>
    </>
  );
}

/** Choose one item (Add Stock lines). Shows the chosen item as a card with an ✕ to change it. */
export function ItemPicker({
  value,
  onChange,
  label,
  error,
  autoFocus,
}: {
  value: PickerItem | null;
  onChange: (item: PickerItem | null) => void;
  label: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const m = useMessages();
  const inputRef = useRef<HTMLInputElement>(null);

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium">{label}</span>
        <div className="flex items-center gap-3 rounded-lg border bg-secondary/50 p-2">
          <ItemPhoto path={value.photoPath} alt="" className="size-11" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="line-clamp-2 font-semibold break-words">{value.label}</span>
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {[value.packSize, value.sku].filter(Boolean).join(" · ")} ·{" "}
              {format(m.stock.inStockNow, {
                stock: `${formatQty(value.stockMilli)} ${value.unitName}`,
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`${m.stock.chooseItem}: ${value.label}`}
          >
            <XIcon className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <SearchCombobox<PickerItem>
      label={label}
      placeholder={m.stock.searchItem}
      search={searchItemsAction}
      getKey={(item) => item.id}
      renderOption={(item) => <ItemOption item={item} />}
      onChoose={onChange}
      noMatchesText={m.stock.noMatches}
      error={error}
      autoFocus={autoFocus}
      inputRef={inputRef}
    />
  );
}
