import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/i18n";

export function RoleBadge({ role, m }: { role: "ADMIN" | "STAFF"; m: Messages }) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "secondary"} className="text-sm">
      {m.roles[role]}
    </Badge>
  );
}

export function StatusBadge({ isActive, m }: { isActive: boolean; m: Messages }) {
  return isActive ? (
    <Badge variant="outline" className="border-success text-sm text-success">
      {m.users.active}
    </Badge>
  ) : (
    <Badge variant="outline" className="border-destructive text-sm text-destructive">
      {m.users.inactive}
    </Badge>
  );
}
