"use client";

import { AlarmClock, CircleCheck, ClipboardList, MailOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageTitle, Panel, RoleGuard, StatCard } from "@/components/dashboard/dashboard-shell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { ArticleArt } from "@/components/site/artwork";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatShortDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, ReviewerAssignmentSummary, ReviewerProfile } from "@/lib/types";

const ACTIVE = new Set(["invited", "accepted", "in_progress", "overdue"]);

function AssignedArticle({ assignment }: { assignment: ReviewerAssignmentSummary }) {
  const href = `/dashboard/reviewer/assignments/${assignment.id}`;
  return (
    <li className="flex flex-wrap items-center gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="aspect-4/3 w-20 shrink-0 overflow-hidden rounded-lg">
        <ArticleArt seed={assignment.id} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={href} className="font-heading leading-snug font-semibold text-primary hover:underline">
          {assignment.articleTitle}
        </Link>
        <p className="text-xs text-muted-foreground">
          {assignment.articleCategory ? `${assignment.articleCategory} · ` : ""}Due {formatShortDate(assignment.dueDate)}
          {assignment.reviewRound > 1 ? ` · Round ${assignment.reviewRound}` : ""}
        </p>
        <div><StatusBadge status={assignment.status} /></div>
      </div>
      <Link href={href} className={cn(buttonVariants({ variant: "outline" }), "border-primary text-primary")}>
        {assignment.status === "invited" ? "Respond" : "Review"}
      </Link>
    </li>
  );
}

function AvailabilityCard({ profile, onChange }: { profile: ReviewerProfile; onChange: (profile: ReviewerProfile) => void }) {
  const [saving, setSaving] = useState(false);
  const available = profile.availability === "available";

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      const { data } = await api.patch<{ data: ReviewerProfile }>("/reviewer/profile", { availability: next ? "available" : "unavailable" });
      onChange(data);
      toast.success(next ? "You are available for review" : "You won't receive new automatic invitations");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border p-4", available ? "border-brand-teal/30 bg-brand-teal/8" : "bg-muted/50")}>
      <div>
        <p id="availability-label" className="text-sm font-medium text-foreground">
          {available ? "You are available for review" : "You are unavailable"}
        </p>
        <p className="text-xs text-muted-foreground">
          Workload: {profile.workload} of {profile.maxPendingReviews} pending
        </p>
      </div>
      <Switch
        checked={available}
        disabled={saving}
        onCheckedChange={(next) => void toggle(next)}
        aria-labelledby="availability-label"
        className="data-checked:bg-brand-teal-strong"
      />
    </div>
  );
}

export default function ReviewerDashboard() {
  const { data, error, loading, reload } = useApiQuery<{ data: ReviewerAssignmentSummary[] }>("/reviewer/assignments");
  const profileQuery = useApiQuery<{ data: ReviewerProfile }>("/reviewer/profile");
  const categories = useApiQuery<{ data: Category[] }>("/categories");
  const [profileOverride, setProfileOverride] = useState<ReviewerProfile | null>(null);
  const profile = profileOverride ?? profileQuery.data?.data ?? null;

  const all = data?.data ?? [];
  const active = all.filter((item) => ACTIVE.has(item.status));
  const count = (status: string) => all.filter((item) => item.status === status).length;
  const categoryName = new Map((categories.data?.data ?? []).map((category) => [category.id, category.name]));

  return (
    <RoleGuard role="reviewer">
      <PageTitle title="Reviewer dashboard" description="Review assigned articles. Your recommendations go to the editors, who make the final decision." />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label="Assigned reviews" value={active.length} icon={ClipboardList} />
            <StatCard label="New invitations" value={count("invited")} icon={MailOpen} tone="amber" />
            <StatCard label="Overdue" value={count("overdue")} icon={AlarmClock} tone="red" />
            <StatCard label="Completed" value={count("completed")} icon={CircleCheck} tone="teal" href="/dashboard/reviewer/reviews" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Assigned articles" action={{ href: "/dashboard/reviewer/reviews", label: "View all" }}>
              {active.length === 0 ? (
                <EmptyState title="No active assignments" description="Invitations from the editors will appear here." />
              ) : (
                <ul>{active.map((item) => <AssignedArticle key={item.id} assignment={item} />)}</ul>
              )}
            </Panel>

            <Panel title="Your expertise" action={{ href: "/dashboard/reviewer/settings", label: "Edit" }}>
              {profile ? (
                <>
                  {profile.expertise.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {profile.expertise.map((item) => (
                        <li key={item.categoryId} className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                          {categoryName.get(item.categoryId) ?? "Category"}
                          <span className="font-normal text-muted-foreground"> · {humanize(item.proficiency)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add your areas of expertise so editors can match you with articles.
                    </p>
                  )}
                  <AvailabilityCard profile={profile} onChange={setProfileOverride} />
                </>
              ) : (
                <LoadingSkeleton rows={2} />
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </RoleGuard>
  );
}
