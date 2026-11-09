"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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

export function SignInForm() {
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
