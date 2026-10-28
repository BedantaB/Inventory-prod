"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import { Input } from "@/components/ui/input";

/** "From" and "to" date boxes that filter a list through the URL (?from=YYYY-MM-DD&to=…). */
export function DateRangeFilter({ fromLabel, toLabel }: { fromLabel: string; toLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = useId();
  const [pending, startTransition] = useTransition();

  const set = (param: "from" | "to", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2" aria-busy={pending}>
      {(["from", "to"] as const).map((param) => (
        <div key={param} className="flex flex-col gap-1">
          <label htmlFor={`${id}-${param}`} className="text-sm font-medium">
            {param === "from" ? fromLabel : toLabel}
          </label>
          <Input
            id={`${id}-${param}`}
            type="date"
            value={searchParams.get(param) ?? ""}
            onChange={(e) => set(param, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
