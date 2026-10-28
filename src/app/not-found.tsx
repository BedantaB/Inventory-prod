import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n";

export default function NotFound() {
  const m = getMessages();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <SearchXIcon className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">{m.common.notFound}</h1>
      <p className="max-w-md text-muted-foreground">{m.common.notFoundBody}</p>
      <Button size="lg" asChild>
        <Link href="/">{m.common.goHome}</Link>
      </Button>
    </main>
  );
}
