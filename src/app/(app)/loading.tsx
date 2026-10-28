import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="mt-2 h-12 w-full" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
