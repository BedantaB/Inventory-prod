import type { LucideIcon } from "lucide-react";

/** Friendly message for an empty list, with the next step as a button. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="max-w-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
