import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/i18n";
import type { StockStatus } from "../data";

/** Only low and out-of-stock get a badge, so the warnings stand out. */
export function StockBadge({ status, m }: { status: StockStatus; m: Messages }) {
  if (status === "out") {
    return <Badge className="bg-destructive text-sm text-white">{m.items.stockOut}</Badge>;
  }
  if (status === "low") {
    return <Badge className="bg-warning text-sm text-warning-foreground">{m.items.stockLow}</Badge>;
  }
  return null;
}
