"use client";

import { Loader2Icon, ShoppingCartIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";

/** Submit button for the "start order" forms (shows a spinner while the cart is being created). */
export function StartOrderButton({
  label,
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const m = useMessages();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
      className="w-full sm:w-auto"
    >
      {pending ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <ShoppingCartIcon aria-hidden />
      )}
      {pending ? m.orders.starting : (label ?? m.orders.start)}
    </Button>
  );
}
