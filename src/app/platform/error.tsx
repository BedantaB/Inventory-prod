"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";

export default function PlatformError({ error, retry }: { error: unknown; retry: () => void }) {
  const m = useMessages();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
      <TriangleAlertIcon className="size-12 text-destructive" aria-hidden />
      <h1 className="text-2xl font-bold">{m.common.somethingWrong}</h1>
      <p className="max-w-md text-muted-foreground">{m.common.somethingWrongBody}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => retry()}>
          <RotateCcwIcon aria-hidden />
          {m.common.tryAgain}
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/platform">{m.common.goHome}</Link>
        </Button>
      </div>
    </div>
  );
}
