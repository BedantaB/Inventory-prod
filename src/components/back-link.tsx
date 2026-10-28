import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

/** "← Items" link above a page title. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-1 -ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-base text-primary hover:underline"
    >
      <ArrowLeftIcon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
