import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { getMessages } from "@/i18n";

export function BackToUsers() {
  const m = getMessages();
  return (
    <Link
      href="/users"
      className="mb-1 -ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-base text-primary hover:underline"
    >
      <ArrowLeftIcon className="size-5" aria-hidden />
      {m.users.title}
    </Link>
  );
}
