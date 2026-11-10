"use client";

import { Bell, Bookmark, ChevronDown, FileText, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/site/author-profile";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ITEM = "gap-2.5 px-2.5 py-2";

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Reserve the space while loading, so the header doesn't jump.
  if (isPending) return <div className="h-9 w-36" />;

  if (!session) {
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

  const { user } = session;
  // `role` is an extra field the API adds to Better Auth's user.
  const role = (user as { role?: Role }).role ?? "reader";

  async function signOut() {
    const result = await authClient.signOut();
    if (result.error) {
      toast.error("We could not sign you out. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center gap-2 rounded-full border bg-background py-1 pr-2.5 pl-1 text-sm font-medium outline-none hover:border-primary/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary/50 data-popup-open:bg-muted"
      >
        <Avatar name={user.name} image={user.image ?? null} size="sm" className="size-7" />
        <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={user.name} image={user.image ?? null} size="sm" className="size-9" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className={ITEM} render={<Link href="/dashboard" />}>
            <LayoutDashboard /> Dashboard
          </DropdownMenuItem>
          {/* Only writers have articles of their own. */}
          {role === "writer" ? (
            <DropdownMenuItem className={ITEM} render={<Link href="/dashboard/writer/articles" />}>
              <FileText /> My articles
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className={ITEM} render={<Link href="/dashboard/notifications" />}>
            <Bell /> Notifications
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} render={<Link href="/dashboard/bookmarks" />}>
            <Bookmark /> Bookmarks
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} render={<Link href="/dashboard/profile" />}>
            <UserRound /> Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className={cn(ITEM, "font-medium")} onClick={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
