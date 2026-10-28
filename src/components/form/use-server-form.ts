"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { useT } from "@/i18n/provider";
import { formDataToObject, zodFieldErrors, type ActionResult, type FieldErrors } from "@/lib/forms";

type Options<Data> = {
  /** Same Zod schema the server uses: gives instant inline errors. */
  schema?: z.ZodType;
  onSuccess?: (result: Extract<ActionResult<Data>, { ok: true }>) => void;
  /** Show the success message as a toast (default true). */
  toastOnSuccess?: boolean;
  /** Add things that aren't plain inputs (e.g. a resized photo) just before sending. */
  prepareFormData?: (formData: FormData) => void;
};

/**
 * Wires a <form> to a server action:
 * - validates with the shared schema on blur and before sending (inline errors)
 * - Enter moves to the next field; on the last field it submits
 * - shows a loading state, then a success or error toast
 * - keeps what the person typed if the server says something is wrong
 */
export function useServerForm<Data = undefined>(
  action: (formData: FormData) => Promise<ActionResult<Data> | undefined>,
  { schema, onSuccess, toastOnSuccess = true, prepareFormData }: Options<Data> = {},
) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const touched = useRef(new Set<string>());

  const validate = useCallback(
    (form: HTMLFormElement, onlyTouched: boolean): FieldErrors => {
      if (!schema) return {};
      const parsed = schema.safeParse(formDataToObject(new FormData(form)));
      if (parsed.success) return {};
      const all = zodFieldErrors(parsed.error);
      if (!onlyTouched) return all;
      return Object.fromEntries(Object.entries(all).filter(([name]) => touched.current.has(name)));
    },
    [schema],
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (event.target !== event.currentTarget) return; // a form inside a dialog, not this one
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const clientErrors = validate(form, false);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstError(form, clientErrors);
      return;
    }
    const formData = new FormData(form);
    prepareFormData?.(formData);
    startTransition(async () => {
      const result = await action(formData);
      if (!result) return; // the action redirected
      if (result.ok) {
        setErrors({});
        if (toastOnSuccess && result.message)
          toast.success(t(result.message.key, result.message.vars));
        onSuccess?.(result);
      } else {
        setErrors(result.fieldErrors ?? {});
        if (result.message) toast.error(t(result.message.key, result.message.vars));
        if (result.fieldErrors) focusFirstError(form, result.fieldErrors);
      }
    });
  };

  const onBlur = (event: React.FocusEvent<HTMLFormElement>) => {
    if (!ownsEvent(event)) return;
    const name = fieldName(event.target);
    if (!name) return;
    touched.current.add(name);
    const fieldErrors = validate(event.currentTarget, true);
    setErrors((prev) => {
      const next = { ...prev };
      if (fieldErrors[name]) next[name] = fieldErrors[name];
      else delete next[name];
      return next;
    });
  };

  const onChange = (event: React.FormEvent<HTMLFormElement>) => {
    if (!ownsEvent(event)) return;
    const name = fieldName(event.target);
    if (name && errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  /** Remove errors whose field name matches (e.g. after picking an item or removing a line). */
  const clearErrors = useCallback((match: (name: string) => boolean) => {
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([name]) => !match(name))));
  }, []);

  const errorFor = (name: string) => {
    const error = errors[name];
    return error ? t(error.key, error.vars) : undefined;
  };

  return {
    pending,
    errorFor,
    clearErrors,
    formProps: { onSubmit, onBlur, onChange, onKeyDown: moveToNextFieldOnEnter, noValidate: true },
  };
}

/**
 * React passes events from dialogs (rendered elsewhere in the page) up to the form that contains
 * them in the component tree. Only react to fields that are really inside this form.
 */
function ownsEvent(event: React.SyntheticEvent<HTMLFormElement>): boolean {
  return event.target instanceof Node && event.currentTarget.contains(event.target);
}

/** Name of the input/select/textarea an event came from ("" for anything else). */
function fieldName(target: EventTarget): string {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
    ? target.name
    : "";
}

function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  const element = first ? form.elements.namedItem(first) : null;
  if (element instanceof HTMLElement) element.focus();
}

const FIELD_SELECTOR =
  "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type=submit]:not([disabled]), [role=combobox]:not([disabled])";

/** Enter on a text field jumps to the next field (desktop data entry); on the last one it submits. */
export function moveToNextFieldOnEnter(event: React.KeyboardEvent<HTMLFormElement>) {
  const target = event.target as HTMLElement;
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
  if (!event.currentTarget.contains(target)) return;
  if (!(target instanceof HTMLInputElement)) return;
  if (["submit", "button", "checkbox", "radio", "file"].includes(target.type)) return;

  const fields = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FIELD_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === target);
  const next = fields[fields.indexOf(target) + 1];
  if (!next || (next instanceof HTMLButtonElement && next.type === "submit")) return; // submit
  event.preventDefault();
  next.focus();
}
