import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      {/* Reading the URL's token needs a Suspense boundary. */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
