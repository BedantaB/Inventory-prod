"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Search-as-you-type box with a list of results (items, customers…). Accessible combobox:
 * ↑/↓ move, Enter picks, Esc closes; Enter never submits the surrounding form.
 */
export function SearchCombobox<T>({
  label,
  placeholder,
  search,
  getKey,
  renderOption,
  onChoose,
  noMatchesText,
  error,
  autoFocus,
  inputRef: externalRef,
}: {
  label: string;
  placeholder: string;
  search: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  renderOption: (item: T) => React.ReactNode;
  onChoose: (item: T) => void;
  noMatchesText: string;
  error?: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const m = useMessages();
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? ownRef;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
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
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus, inputRef]);

  const openList = () => {
    // Coming back quickly must cancel a close that was scheduled when the box lost focus.
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const runSearch = (text: string) => {
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
        const found = await search(text);
        if (requestId !== latest.current) return; // a newer search has started
        setResults(found);
        setActive(0);
        setSearched(true);
      });
    }, 200);
  };

  const choose = (item: T) => {
    onChoose(item);
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
    latest.current++;
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
      event.preventDefault();
      event.stopPropagation();
      if (open && results[active]) choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

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
          onChange={(e) => runSearch(e.target.value)}
          onFocus={openList}
          // Close a moment later so a tap on an option still counts.
          onBlur={() => {
            closeTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
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
              key={getKey(item)}
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
              {renderOption(item)}
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground" role="presentation">
              {query.trim().length < 2
                ? m.stock.typeToSearch
                : pending || !searched
                  ? m.stock.searching
                  : noMatchesText}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
