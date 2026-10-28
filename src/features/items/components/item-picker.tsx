"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { formatQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import { searchItemsAction, type PickerItem } from "../actions";
import { ItemPhoto } from "./item-photo";

/**
 * Search-as-you-type item chooser (Add Stock, New Order). Accessible combobox:
 * ↑/↓ move, Enter picks, Esc closes. Shows the chosen item as a card with a "change" button.
 */
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
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  const openList = () => {
    // Coming back quickly must cancel a close that was scheduled when the box lost focus.
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  useEffect(() => {
    if (autoFocus && !value) inputRef.current?.focus();
  }, [autoFocus, value]);

  const search = (text: string) => {
    setQuery(text);
    openList();
    clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const requestId = ++latest.current;
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const found = await searchItemsAction(text);
        if (requestId !== latest.current) return; // a newer search has started
        setResults(found);
        setActive(0);
        setSearched(true);
      });
    }, 200);
  };

  const choose = (item: PickerItem) => {
    onChange(item);
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openList();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Never submit the whole form from the search box.
      event.preventDefault();
      event.stopPropagation();
      if (open && results[active]) choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

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

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={openList}
          // Close a moment later so a tap on an option still counts.
          onBlur={() => {
            closeTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={m.stock.searchItem}
          autoComplete="off"
          enterKeyHint="search"
          className="pr-10 pl-10"
        />
        {pending && (
          <Loader2Icon
            className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label={m.stock.searching}
          />
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover shadow-lg"
        >
          {results.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: runs before the input loses focus and closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2",
                index === active && "bg-secondary",
              )}
            >
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
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground" role="presentation">
              {query.trim().length < 2
                ? m.stock.typeToSearch
                : pending || !searched
                  ? m.stock.searching
                  : m.stock.noMatches}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
