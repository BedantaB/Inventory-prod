import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format, getMessages } from "@/i18n";
import { PAGE_SIZE } from "@/lib/list-params";

/** "Showing 21–40 of 55" with big Previous / Next buttons. Keeps the other URL parameters. */
export function Pagination({
  page,
  total,
  pathname,
  searchParams,
}: {
  page: number;
  total: number;
  pathname: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const m = getMessages();
  if (total <= PAGE_SIZE && page === 1) return null;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key !== "page" && typeof value === "string") params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <nav aria-label={m.list.pagination} className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {format(m.list.showing, { from, to, total })}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" asChild>
            <Link href={href(page - 1)} rel="prev">
              <ChevronLeftIcon aria-hidden />
              {m.list.previous}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeftIcon aria-hidden />
            {m.list.previous}
          </Button>
        )}
        {page < lastPage ? (
          <Button variant="outline" asChild>
            <Link href={href(page + 1)} rel="next">
              {m.list.next}
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            {m.list.next}
            <ChevronRightIcon aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}
