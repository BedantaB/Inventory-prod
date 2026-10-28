"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";

/**
 * The big search box at the top of every list. Updates ?q= as you type (after a short pause),
 * so the server filters and the result can be bookmarked or shared.
 */
export function SearchBox({ placeholder, label }: { placeholder: string; label: string }) {
  const m = useMessages();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next.trim()) params.set("q", next.trim());
    else params.delete("q");
    params.delete("page");
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  };

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 250);
  };

  return (
    <div role="search" className="relative">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 pr-12 pl-10 text-lg [&::-webkit-search-cancel-button]:hidden"
        enterKeyHint="search"
        autoComplete="off"
      />
      <div className="absolute inset-y-0 right-0 flex w-12 items-center justify-center">
        {pending ? (
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={m.common.clearSearch}
          >
            <XIcon className="size-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
