import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { requireUser } from "@/features/auth/session";
import { getMessages } from "@/i18n";
import { AuthCardHeader } from "../auth-card-header";
import { FormSkeleton } from "../form-skeleton";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  const m = getMessages();
  return (
    <>
      <AuthCardHeader title={m.auth.resetTitle} subtitle={m.auth.resetSubtitle} />
      <Suspense fallback={<FormSkeleton />}>
        <SignedInForm />
      </Suspense>
    </>
  );
}

async function SignedInForm() {
  // The reset link signs the person in (see /auth/callback); without that, go to login.
  await requireUser();
  return <ResetPasswordForm />;
}
