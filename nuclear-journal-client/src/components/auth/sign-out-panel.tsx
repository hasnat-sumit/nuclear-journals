"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutPanel() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setError(null);
    setIsSigningOut(true);
    const result = await authClient.signOut();
    if (result.error) {
      setError("We could not sign you out. Please try again.");
      setIsSigningOut(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (isPending) return <p className="text-sm text-muted-foreground">Checking your account...</p>;
  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <p className="leading-7 text-muted-foreground">You are already signed out.</p>
        <Link href="/sign-in" className="text-sm font-medium text-primary underline underline-offset-4">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="leading-7 text-muted-foreground">You are signed in as {session.user.email}.</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={signOut} disabled={isSigningOut}>
          {isSigningOut ? "Signing out..." : "Sign out"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}
