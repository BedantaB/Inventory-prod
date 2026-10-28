import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { getMessages } from "@/i18n";
import { AuthCardHeader } from "../auth-card-header";
import { FormSkeleton } from "../form-skeleton";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  const m = getMessages();
  return (
    <>
      <AuthCardHeader title={m.auth.forgotTitle} subtitle={m.auth.forgotSubtitle} />
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
