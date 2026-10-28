"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useMessages, useT } from "@/i18n/provider";
import type { ActionResult } from "@/lib/forms";

/**
 * A button that asks "Are you sure?" before running a server action.
 * Use for anything destructive or hard to undo (archive, turn off a login).
 */
export function ConfirmAction({
  trigger,
  title,
  body,
  confirmLabel,
  destructive = true,
  action,
  onDone,
}: {
  trigger: React.ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => Promise<ActionResult<unknown>>;
  onDone?: () => void;
}) {
  const m = useMessages();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(t(result.message.key, result.message.vars));
        setOpen(false);
        onDone?.();
      } else if (result.message) {
        toast.error(t(result.message.key, result.message.vars));
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="h-11 text-base">
            {m.confirm.noGoBack}
          </AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={run}
            disabled={pending}
            aria-busy={pending}
            className={
              destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
