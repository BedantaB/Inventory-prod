"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";

export function PrintButton() {
  const m = useMessages();
  return (
    <Button size="lg" variant="outline" onClick={() => window.print()}>
      <PrinterIcon aria-hidden />
      {m.orders.print}
    </Button>
  );
}
