"use client";

import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { updateStaffUser } from "../actions";
import type { UserRow } from "../queries";
import { updateUserSchema } from "../schemas";
import { RolePicker } from "./role-picker";

export function EditUserForm({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const m = useMessages();
  const { pending, errorFor, formProps } = useServerForm(updateStaffUser.bind(null, user.id), {
    schema: updateUserSchema,
  });

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <FormField name="fullName" label={m.users.fullName} error={errorFor("fullName")} required>
        {(p) => <Input {...p} defaultValue={user.fullName} autoComplete="off" />}
      </FormField>
      <FormField name="usernameDisplay" label={m.users.username} hint={m.users.usernameFixed}>
        {(p) => <Input {...p} name={undefined} value={user.username} readOnly disabled />}
      </FormField>
      {isSelf && <input type="hidden" name="role" value={user.role} />}
      <RolePicker m={m} defaultValue={user.role} disabled={isSelf} error={errorFor("role")} />
      {isSelf && <p className="-mt-3 text-sm text-muted-foreground">{m.users.selfRoleNote}</p>}
      <SubmitButton
        pending={pending}
        label={m.common.save}
        pendingLabel={m.common.saving}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
