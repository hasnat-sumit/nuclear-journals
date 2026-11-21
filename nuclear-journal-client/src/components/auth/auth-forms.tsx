"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const emailField = z.email("Enter a valid email address");
const passwordField = z.string().min(10, "Use at least 10 characters").max(128);

const signInSchema = z.object({ email: emailField, password: z.string().min(1, "Enter your password") });
const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: emailField,
  password: passwordField,
});

// Error codes Better Auth adds to the URL when it sends someone back from Google.
const GOOGLE_ERRORS: Record<string, string> = {
  account_not_linked:
    "This email is already registered with a password but hasn't been verified. Verify your email or sign in with your password first.",
  access_denied: "Google sign-in was cancelled.",
  unable_to_create_user: "We could not create your account. Please try again.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

// One button for both sign-in and sign-up: Google creates the account on first use.
function GoogleSignInInner() {
  const errorCode = useSearchParams().get("error");
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const shownError = error ?? (errorCode ? (GOOGLE_ERRORS[errorCode] ?? "Google sign-in failed. Please try again.") : null);

  async function signIn() {
    setError(null);
    setIsRedirecting(true);
    // On success the browser leaves this page for Google, so there is nothing more to do here.
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/sign-in",
    });
    if (result.error) {
      setError(
        result.error.status === 404
          ? "Google sign-in isn't available right now."
          : "We could not reach Google. Please try again.",
      );
      setIsRedirecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" onClick={signIn} disabled={isRedirecting} className="gap-2">
        <GoogleIcon />
        {isRedirecting ? "Opening Google" : "Continue with Google"}
      </Button>
      {shownError ? <p role="alert" className="text-sm text-destructive">{shownError}</p> : null}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or use your email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function GoogleSignIn() {
  // Reading the URL's error code needs a Suspense boundary.
  return (
    <Suspense>
      <GoogleSignInInner />
    </Suspense>
  );
}

export function SignInForm() {
  return (
    <div className="flex flex-col gap-4">
      <GoogleSignIn />
      <EmailSignInForm />
    </div>
  );
}

function EmailSignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(signInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.signIn.email(values);
    if (result.error) {
      setError(
        result.error.status === 403
          ? "Please verify your email first. Check your inbox for the link."
          : "Incorrect email or password.",
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
      </Field>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Signing in" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-primary underline underline-offset-4">Forgot password?</Link>
        <Link href="/sign-up" className="text-primary underline underline-offset-4">Create an account</Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(signUpSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.signUp.email({ ...values, callbackURL: "/dashboard" });
    if (result.error) {
      setError(result.error.message ?? "We could not create your account. Please try again.");
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <p role="status" className="leading-7">
        Almost there. We sent you a link to verify your email address. Open it to finish creating your account.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignIn />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Full name" htmlFor="name" error={formState.errors.name?.message}>
          <Input id="name" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters." error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Creating account" : "Create account"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Already registered? <Link href="/sign-in" className="text-primary underline underline-offset-4">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

const forgotSchema = z.object({ email: emailField });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    // The same message either way, so this form can't reveal who has an account.
    setSent(true);
  });

  if (sent) {
    return <p role="status" className="leading-7">If that address has an account, a reset link is on its way.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Button type="submit" disabled={formState.isSubmitting}>Send reset link</Button>
    </form>
  );
}

const resetSchema = z.object({ password: passwordField });

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(resetSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    const result = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
    if (result.error) {
      toast.error("This reset link is invalid or has expired.");
      return;
    }
    toast.success("Password updated. Please sign in.");
    router.push("/sign-in");
  });

  if (!token) {
    return <p role="alert">This reset link is invalid. Please request a new one.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="New password" htmlFor="password" hint="At least 10 characters." error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Button type="submit" disabled={formState.isSubmitting}>Update password</Button>
    </form>
  );
}
