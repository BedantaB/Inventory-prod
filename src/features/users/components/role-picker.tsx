import type { Messages } from "@/i18n";
import { cn } from "@/lib/utils";

/** Two big radio cards (clearer than a dropdown for first-time users). */
export function RolePicker({
  m,
  defaultValue = "STAFF",
  disabled,
  error,
}: {
  m: Messages;
  defaultValue?: "ADMIN" | "STAFF";
  disabled?: boolean;
  error?: string;
}) {
  const options = [
    { value: "STAFF", label: m.roles.STAFF, hint: m.users.roleStaffHint },
    { value: "ADMIN", label: m.roles.ADMIN, hint: m.users.roleAdminHint },
  ] as const;

  return (
    <fieldset
      className="flex flex-col gap-2"
      disabled={disabled}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 text-base font-medium">{m.users.role}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-3 has-focus-visible:outline-ring",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name="role"
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="mt-1 size-5 accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
