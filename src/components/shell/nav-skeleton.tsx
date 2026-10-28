import { Skeleton } from "@/components/ui/skeleton";

// Placeholders shown for a moment while the login is read. They must not read the URL
// (usePathname), because they are part of the prerendered page shell.

export function SidebarNavSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4" aria-hidden>
      <Skeleton className="mb-4 h-12 w-40" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function BottomNavSkeleton() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center gap-2 border-t bg-background px-3 md:hidden print:hidden"
      aria-hidden
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 flex-1" />
      ))}
    </div>
  );
}
