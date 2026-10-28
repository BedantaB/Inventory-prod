import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The main button of a form. Shows a spinner and a "…ing" label while saving. */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
  className,
  size = "lg",
  icon,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  className?: string;
  size?: "default" | "lg";
  icon?: React.ReactNode;
}) {
  return (
    <Button type="submit" size={size} disabled={pending} aria-busy={pending} className={className}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : icon}
      {pending ? pendingLabel : label}
    </Button>
  );
}
