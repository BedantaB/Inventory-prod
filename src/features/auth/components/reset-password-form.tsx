"use client";

import { useRouter } from "next/navigation";
import { FormField } from "@/components/form/form-field";
import { PasswordInput } from "@/components/form/password-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { useMessages } from "@/i18n/provider";
import { updateOwnPassword } from "../actions";
import { newPasswordSchema } from "../schemas";

export function ResetPasswordForm() {
  const m = useMessages();
  const router = useRouter();
  const { pending, errorFor, formProps } = useServerForm(updateOwnPassword, {
    schema: newPasswordSchema,
    onSuccess: () => router.replace("/"),
  });

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <FormField
        name="password"
        label={m.auth.newPassword}
        hint={m.users.passwordHint}
        error={errorFor("password")}
        required
      >
        {(p) => <PasswordInput {...p} autoComplete="new-password" autoFocus />}
      </FormField>
      <FormField
        name="confirmPassword"
        label={m.auth.confirmPassword}
        error={errorFor("confirmPassword")}
        required
      >
        {(p) => <PasswordInput {...p} autoComplete="new-password" />}
      </FormField>
      <SubmitButton
        pending={pending}
        label={m.auth.savePassword}
        pendingLabel={m.common.saving}
        className="w-full"
      />
    </form>
  );
}
