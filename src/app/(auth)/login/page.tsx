import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { getMessages } from "@/i18n";
import { AuthCardHeader } from "../auth-card-header";
import { FormSkeleton } from "../form-skeleton";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  const m = getMessages();
  return (
    <>
      <AuthCardHeader title={m.auth.loginTitle} subtitle={m.auth.loginSubtitle} />
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
