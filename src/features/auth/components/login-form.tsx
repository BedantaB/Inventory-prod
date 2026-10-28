"use client";

import { LogInIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormField } from "@/components/form/form-field";
import { PasswordInput } from "@/components/form/password-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { login } from "../actions";
import { loginSchema } from "../schemas";

export function LoginForm() {
  const m = useMessages();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const { pending, errorFor, formProps } = useServerForm(login, { schema: loginSchema });

  return (
    <form {...formProps} className="flex flex-col gap-5">
      {reason === "inactive" && (
        <Alert variant="destructive">
          <AlertDescription className="text-base">{m.auth.sessionEnded}</AlertDescription>
        </Alert>
      )}
      {reason === "logged-out" && (
        <Alert>
          <AlertDescription className="text-base">{m.auth.loggedOut}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="next" value={searchParams.get("next") ?? "/"} />

      <FormField
        name="identifier"
        label={m.auth.identifier}
        hint={m.auth.identifierHint}
        error={errorFor("identifier")}
        required
      >
        {(p) => (
          <Input
            {...p}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            enterKeyHint="next"
          />
        )}
      </FormField>

      <FormField name="password" label={m.auth.password} error={errorFor("password")} required>
        {(p) => <PasswordInput {...p} autoComplete="current-password" enterKeyHint="go" />}
      </FormField>

      <SubmitButton
        pending={pending}
        label={m.auth.loginButton}
        pendingLabel={m.auth.loggingIn}
        icon={<LogInIcon aria-hidden />}
        className="w-full"
      />

      <Link
        href="/forgot-password"
        className="self-center rounded px-2 py-2 text-base text-primary underline-offset-4 hover:underline"
      >
        {m.auth.forgotPasswordLink}
      </Link>
    </form>
  );
}
