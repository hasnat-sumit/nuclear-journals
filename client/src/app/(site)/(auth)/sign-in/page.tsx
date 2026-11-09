import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <SignInForm />
    </>
  );
}
