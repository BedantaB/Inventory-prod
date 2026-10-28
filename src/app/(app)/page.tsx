import { Suspense } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { getDashboard } from "@/features/dashboard/queries";
import { format, getMessages } from "@/i18n";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const m = getMessages();
  const user = await requireUser();
  const [sp, data] = await Promise.all([searchParams, getDashboard(can(user, "viewCost"))]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          {format(m.home.greeting, { name: user.fullName.split(" ")[0] })}
        </h1>
        <p className="text-base text-muted-foreground">{m.home.subtitle}</p>
      </header>
      {sp.denied === "1" && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="text-base">{m.home.denied}</AlertDescription>
        </Alert>
      )}
      <DashboardView data={data} m={m} />
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div>
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
