import type { z } from "zod";
import type { MessageKey, MessageVars } from "@/i18n";

/** An error or message as an i18n key, optionally with {placeholder} values. */
export type Message = { key: MessageKey; vars?: MessageVars };
export type FieldErrors = Partial<Record<string, Message>>;

/** What every server action returns. The client turns keys into text and shows toasts. */
export type ActionResult<Data = undefined> =
  | { ok: true; message?: Message; data?: Data }
  | { ok: false; message?: Message; fieldErrors?: FieldErrors };

export function success<Data = undefined>(
  key?: MessageKey,
  vars?: MessageVars,
  data?: Data,
): ActionResult<Data> {
  return { ok: true, message: key ? { key, vars } : undefined, data };
}

export function failure(key: MessageKey, vars?: MessageVars): ActionResult<never> {
  return { ok: false, message: { key, vars } };
}

export function fieldFailure(
  field: string,
  key: MessageKey,
  vars?: MessageVars,
): ActionResult<never> {
  return {
    ok: false,
    message: { key: "validation.fixErrors" },
    fieldErrors: { [field]: { key, vars } },
  };
}

/** FormData → plain object of strings (files and repeated keys are not used by these forms). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) result[key] = value;
  });
  return result;
}

/**
 * Zod issues → first error per field. Schema messages are i18n keys (see schemas.ts files).
 * Nested fields use dotted names, e.g. "lines.2.quantity" for the third line's quantity.
 */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    if (!errors[field]) errors[field] = { key: issue.message as MessageKey };
  }
  return errors;
}

/** Validates FormData on the server with the same schema the client used. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(formDataToObject(formData));
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: {
      ok: false,
      message: { key: "validation.fixErrors" },
      fieldErrors: zodFieldErrors(parsed.error),
    },
  };
}
