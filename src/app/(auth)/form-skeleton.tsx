import { Skeleton } from "@/components/ui/skeleton";

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
