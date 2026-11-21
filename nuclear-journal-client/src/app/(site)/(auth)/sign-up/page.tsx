import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Create an account</h1>
        <p className="leading-7 text-muted-foreground">
          You don&apos;t need an account to read. Register to comment, save articles, or apply to write or review.
        </p>
      </div>
      <SignUpForm />
    </>
  );
}
