"use client";

import Link from "next/link";
import { Avatar } from "@/components/site/author-profile";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();

  // Reserve the space while loading, so the header doesn't jump.
  if (isPending) return <div className="h-9 w-36" />;

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 rounded-full pr-3 pl-1")}>
          <Avatar name={session.user.name} image={session.user.image ?? null} size="sm" className="size-7" />
          Dashboard
        </Link>
        <Link href="/sign-out" className="text-sm font-medium text-muted-foreground hover:text-primary">Sign out</Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/sign-in" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
        Log in
      </Link>
      <Link
        href="/sign-up"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-primary px-4 text-primary hover:bg-primary hover:text-primary-foreground")}
      >
        Apply
      </Link>
    </div>
  );
}
