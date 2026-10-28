"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/form/form-field";
import { PasswordInput } from "@/components/form/password-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { resetUserPassword } from "../actions";
import type { UserRow } from "../queries";
import { resetUserPasswordSchema } from "../schemas";

export function ResetPasswordDialog({ user }: { user: UserRow }) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const { pending, errorFor, formProps } = useServerForm(resetUserPassword.bind(null, user.id), {
    schema: resetUserPasswordSchema,
    onSuccess: () => setOpen(false),
  });
  const vars = { name: user.fullName };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <KeyRoundIcon aria-hidden />
          {m.users.resetPassword}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">{format(m.users.resetPasswordTitle, vars)}</DialogTitle>
          <DialogDescription className="text-base">
            {format(m.users.resetPasswordBody, vars)}
          </DialogDescription>
        </DialogHeader>
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
          <SubmitButton
            pending={pending}
            label={m.auth.savePassword}
            pendingLabel={m.common.saving}
            className="w-full"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
