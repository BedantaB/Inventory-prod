import { PackageIcon } from "lucide-react";
import { getMessages } from "@/i18n";

/** Simple centred card for login and password screens. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const m = getMessages();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-secondary px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <PackageIcon className="size-7" aria-hidden />
        </div>
        <div>
          <p className="text-xl font-bold">{m.app.name}</p>
          <p className="text-sm text-muted-foreground">{m.app.tagline}</p>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </main>
  );
}
