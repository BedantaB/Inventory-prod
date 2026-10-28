"use client";

import { MailIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { requestPasswordReset } from "../actions";
import { forgotPasswordSchema } from "../schemas";

export function ForgotPasswordForm() {
  const m = useMessages();
  const linkFailed = useSearchParams().get("error") === "link";
  const [sent, setSent] = useState(false);
  const { pending, errorFor, formProps } = useServerForm(requestPasswordReset, {
    schema: forgotPasswordSchema,
    toastOnSuccess: false,
    onSuccess: () => setSent(true),
  });

  return (
    <div className="flex flex-col gap-5">
      {linkFailed && (
        <Alert variant="destructive">
          <AlertDescription className="text-base">{m.auth.resetLinkInvalid}</AlertDescription>
        </Alert>
      )}
      {sent ? (
        <Alert>
          <MailIcon aria-hidden />
          <AlertDescription className="text-base" role="status">
            {m.auth.resetLinkSent}
          </AlertDescription>
        </Alert>
      ) : (
        <form {...formProps} className="flex flex-col gap-5">
          <FormField name="email" label={m.auth.email} error={errorFor("email")} required>
            {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" autoFocus />}
          </FormField>
          <SubmitButton
            pending={pending}
            label={m.auth.sendResetLink}
            pendingLabel={m.auth.sending}
            className="w-full"
          />
        </form>
      )}
      <Link
        href="/login"
        className="self-center rounded px-2 py-2 text-base text-primary underline-offset-4 hover:underline"
      >
        {m.auth.backToLogin}
      </Link>
    </div>
  );
}
