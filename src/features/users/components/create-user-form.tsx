"use client";

import { UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/form/form-field";
import { FreshForm } from "@/components/form/fresh-form";
import { PasswordInput } from "@/components/form/password-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { createStaffUser } from "../actions";
import { createUserSchema } from "../schemas";
import { RolePicker } from "./role-picker";

export function CreateUserForm() {
  return <FreshForm>{(onSaved) => <CreateUserFormBody onSaved={onSaved} />}</FreshForm>;
}

function CreateUserFormBody({ onSaved }: { onSaved: () => void }) {
  const m = useMessages();
  const router = useRouter();
  const { pending, errorFor, formProps } = useServerForm(createStaffUser, {
    schema: createUserSchema,
    onSuccess: () => {
      router.push("/users");
      onSaved();
    },
  });

  return (
    <form {...formProps} className="flex max-w-xl flex-col gap-5">
      <FormField name="fullName" label={m.users.fullName} error={errorFor("fullName")} required>
        {(p) => (
          <Input {...p} placeholder={m.users.fullNamePlaceholder} autoComplete="off" autoFocus />
        )}
      </FormField>
      <FormField
        name="username"
        label={m.users.username}
        hint={m.users.usernameHint}
        error={errorFor("username")}
        required
      >
        {(p) => (
          <Input
            {...p}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField
        name="password"
        label={m.users.password}
        hint={m.users.passwordHint}
        error={errorFor("password")}
        required
      >
        {(p) => <PasswordInput {...p} autoComplete="new-password" />}
      </FormField>
      <RolePicker m={m} error={errorFor("role")} />
      <SubmitButton
        pending={pending}
        label={m.users.add}
        pendingLabel={m.common.saving}
        icon={<UserPlusIcon aria-hidden />}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
