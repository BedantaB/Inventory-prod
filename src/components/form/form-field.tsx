"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";

export type ControlProps = {
  id: string;
  name: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
  required?: boolean;
};

/**
 * Label + control + hint + inline error, wired up for screen readers.
 * Usage: <FormField name="username" label="…" error={errorFor("username")}>{(p) => <Input {...p} />}</FormField>
 */
export function FormField({
  name,
  label,
  hint,
  error,
  required,
  optionalLabel,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Shown after the label for optional fields, e.g. "(optional)". */
  optionalLabel?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  // Unique per form: Next keeps recently visited pages mounted (hidden), so two forms with the
  // same field names can be in the page at once.
  const id = `${name}-${useId()}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
        {optionalLabel && (
          <span className="font-normal text-muted-foreground"> ({optionalLabel})</span>
        )}
      </Label>
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        required,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
