export function AuthCardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-base text-muted-foreground">{subtitle}</p>
    </div>
  );
}
