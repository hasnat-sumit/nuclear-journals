"use client";

import {
  ArrowLeft,
  Bell,
  Bookmark,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  Tags,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Avatar } from "@/components/site/author-profile";
import { Logo } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { authClient } from "@/lib/auth-client";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Me, Role } from "@/lib/types";

const MeContext = createContext<{ me: Me; reload: () => void } | null>(null);

export function useMe() {
  const value = use(MeContext);
  if (!value) throw new Error("useMe must be used inside DashboardShell");
  return value;
}

type NavItem = { href: string; label: string; icon: LucideIcon };

const COMMON: NavItem[] = [
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  reader: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  writer: [
    { href: "/dashboard/writer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/writer/articles", label: "My articles", icon: FileText },
    { href: "/dashboard/writer/articles/new", label: "New article", icon: FilePlus2 },
  ],
  reviewer: [
    { href: "/dashboard/reviewer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/reviewer/reviews", label: "My reviews", icon: ClipboardCheck },
    { href: "/dashboard/reviewer/settings", label: "Review settings", icon: Settings },
  ],
  editor: [
    { href: "/dashboard/editor", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/editor/articles", label: "Articles", icon: FileText },
    { href: "/dashboard/editor/assignments", label: "Reviews", icon: ClipboardList },
    { href: "/dashboard/editor/applications", label: "Applications", icon: UserCheck },
    { href: "/dashboard/editor/reviewers", label: "Reviewers", icon: UsersRound },
    { href: "/dashboard/editor/categories", label: "Categories", icon: Tags },
    { href: "/dashboard/editor/moderation", label: "Moderation", icon: MessageSquare },
    { href: "/dashboard/editor/users", label: "Users", icon: Users },
    { href: "/dashboard/editor/logs", label: "Audit log", icon: ScrollText },
  ],
};

// The most specific matching item is active, so "New article" doesn't also light up "My articles".
function activeHref(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = [...NAV_BY_ROLE[role], ...COMMON];
  const current = activeHref(pathname, items);

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const itemClass = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors";

  return (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={current === href ? "page" : undefined}
          className={cn(
            itemClass,
            current === href ? "bg-white/12 font-medium text-white shadow-[inset_3px_0_0_#8fbdb9]" : "text-white/75 hover:bg-white/8 hover:text-white",
          )}
        >
          <Icon aria-hidden="true" className="size-4.5" />
          {label}
        </Link>
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
        <Link href="/" className={cn(itemClass, "text-white/75 hover:bg-white/8 hover:text-white")}>
          <ArrowLeft aria-hidden="true" className="size-4.5" />
          Back to site
        </Link>
        <button type="button" onClick={signOut} className={cn(itemClass, "text-left text-white/75 hover:bg-white/8 hover:text-white")}>
          <LogOut aria-hidden="true" className="size-4.5" />
          Log out
        </button>
      </div>
    </nav>
  );
}

function TopBar({ me }: { me: Me }) {
  const { data } = useApiQuery<{ unread: number }>("/me/notifications?limit=1");
  const unread = data?.unread ?? 0;
  return (
    <div className="hidden items-center justify-end gap-4 border-b bg-card px-8 py-3 md:flex">
      <Link
        href="/dashboard/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 ? (
          <span aria-hidden="true" className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
      <Link href="/dashboard/profile" className="flex items-center gap-3 rounded-full py-1 pr-1 pl-3 hover:bg-muted">
        <span className="text-right text-sm leading-4">
          <span className="block font-medium text-foreground">{me.name}</span>
          <span className="block text-xs text-muted-foreground">{humanize(me.role)}</span>
        </span>
        <Avatar name={me.name} image={me.image} size="sm" className="size-9" />
      </Link>
    </div>
  );
}

function Frame({ me, children }: { me: Me; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Mobile: a bar with a menu button. Desktop: a fixed sidebar. */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-primary px-4 py-3 md:hidden">
        <Logo inverted />
        <Button
          variant="ghost"
          size="icon-lg"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-expanded={open}
          aria-controls="dashboard-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>
      {/* The outer column keeps the navy background full height; the inner part stays in view. */}
      <aside id="dashboard-menu" className={cn("bg-primary md:block md:w-64 md:shrink-0", open ? "block" : "hidden")}>
        <div className="flex flex-col gap-8 px-4 py-6 md:sticky md:top-0 md:h-dvh">
          <Logo inverted className="hidden px-2 md:flex" />
          <SidebarNav role={me.role} onNavigate={() => setOpen(false)} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar me={me} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// Redirecting here is only for convenience. The API enforces every permission.
export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, error, loading, reload } = useApiQuery<{ data: Me }>("/me");
  const signedOut = !loading && !data && error?.includes("sign in");

  useEffect(() => {
    if (signedOut) router.replace("/sign-in");
  }, [signedOut, router]);

  if (loading || signedOut) {
    return <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6"><LoadingSkeleton /></main>;
  }
  if (!data) {
    return <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6"><ErrorState message={error ?? "Could not load your account."} onRetry={reload} /></main>;
  }

  return (
    <MeContext value={{ me: data.data, reload }}>
      <Frame me={data.data}>{children}</Frame>
    </MeContext>
  );
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const STAT_TONES = {
  navy: "bg-primary/8 text-primary",
  amber: "bg-amber-100 text-amber-800",
  teal: "bg-brand-teal/12 text-brand-teal-strong",
  red: "bg-destructive/10 text-destructive",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "navy",
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: keyof typeof STAT_TONES;
  href?: string;
}) {
  const body = (
    <>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", STAT_TONES[tone])}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-heading text-3xl leading-tight font-bold text-primary">{value}</span>
      </span>
    </>
  );
  const className = "flex flex-col items-start gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(className, "transition-all hover:border-brand-teal hover:shadow-sm")}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-sm font-medium text-brand-teal-strong hover:underline">
            {action.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const { me } = useMe();
  if (me.role !== role) {
    return <ErrorState message="You do not have access to this area." />;
  }
  return children;
}

export function PagerButtons({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  );
}
