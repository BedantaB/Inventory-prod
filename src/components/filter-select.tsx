"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";

/** A dropdown that filters or sorts a list by changing one URL parameter. */
export function FilterSelect({
  param,
  label,
  options,
  defaultValue,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const value = searchParams.get(param) ?? defaultValue;

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === defaultValue) params.delete(param);
    else params.set(param, next);
    params.delete("page");
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  };

  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-busy={pending}
      className={pending ? "opacity-70" : undefined}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}
