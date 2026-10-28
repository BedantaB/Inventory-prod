import {
  PackageIcon,
  PackagePlusIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  StoreIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { format, getMessages, type Messages } from "@/i18n";
import { cn } from "@/lib/utils";

// The full dashboard (stock value, low stock, today's sales) arrives in Phase 5.

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

type Tile = {
  href: string;
  icon: LucideIcon;
  label: keyof Messages["nav"];
  hint: keyof Messages["home"];
  primary?: boolean;
};

const TILES: Tile[] = [
  {
    href: "/orders/new",
    icon: ShoppingCartIcon,
    label: "newOrder",
    hint: "newOrderHint",
    primary: true,
  },
  {
    href: "/stock/new",
    icon: PackagePlusIcon,
    label: "addStock",
    hint: "addStockHint",
    primary: true,
  },
  { href: "/items", icon: PackageIcon, label: "items", hint: "itemsHint" },
  { href: "/customers", icon: StoreIcon, label: "customers", hint: "customersHint" },
  { href: "/orders", icon: ReceiptTextIcon, label: "orders", hint: "ordersHint" },
];

const ADMIN_TILE: Tile = { href: "/users", icon: UserCogIcon, label: "users", hint: "usersHint" };

async function HomeContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const m = getMessages();
  const user = await requireUser();
  const denied = (await searchParams).denied === "1";
  const tiles = user.role === "ADMIN" ? [...TILES, ADMIN_TILE] : TILES;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          {format(m.home.greeting, { name: user.fullName.split(" ")[0] })}
        </h1>
        <p className="text-base text-muted-foreground">{m.home.subtitle}</p>
      </header>

      {denied && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="text-base">{m.home.denied}</AlertDescription>
        </Alert>
      )}

      <h2 className="sr-only">{m.home.quickActions}</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className={cn(
                "flex min-h-20 items-center gap-4 rounded-xl border p-4 transition-colors",
                tile.primary
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-card hover:bg-secondary",
              )}
            >
              <tile.icon className="size-8 shrink-0" aria-hidden />
              <span className="flex flex-col">
                <span className="text-lg font-semibold">{m.nav[tile.label]}</span>
                <span
                  className={cn(
                    "text-sm",
                    tile.primary ? "text-primary-foreground/90" : "text-muted-foreground",
                  )}
                >
                  {m.home[tile.hint]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-6 h-5 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
