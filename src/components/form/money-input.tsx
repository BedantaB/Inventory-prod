import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Rupee amount box: ₹ sign in front, number keypad with decimal point on phones. */
export function MoneyInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative", className)}>
      <span
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-foreground"
        aria-hidden
      >
        ₹
      </span>
      <Input {...props} inputMode="decimal" autoComplete="off" className="pl-8" />
    </div>
  );
}
