"use client";

import { CircleCheck, Inbox, MessageSquare, PenLine, Search, Tags, UserPlus, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageTitle, Panel, RoleGuard, StatCard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { cn } from "@/lib/utils";
import type { ArticleStatus, EditorArticleRow, EditorOverview, Paginated } from "@/lib/types";

const ATTENTION: { key: keyof EditorOverview; label: string; href: string }[] = [
  { key: "pendingWriters", label: "Writer applications", href: "/dashboard/editor/applications" },
  { key: "pendingReviewers", label: "Reviewer applications", href: "/dashboard/editor/applications" },
  { key: "underReview", label: "Under review", href: "/dashboard/editor/articles?status=under_review" },
  { key: "activeAssignments", label: "Active assignments", href: "/dashboard/editor/assignments" },
  { key: "declinedAssignments", label: "Declined assignments", href: "/dashboard/editor/assignments?status=declined" },
  { key: "overdueReviews", label: "Overdue reviews", href: "/dashboard/editor/assignments?status=overdue" },
  { key: "approved", label: "Approved, not yet published", href: "/dashboard/editor/articles?status=approved" },
  { key: "pendingComments", label: "Comments to moderate", href: "/dashboard/editor/moderation" },
];

const NEXT_ACTION: Partial<Record<ArticleStatus, string>> = {
  submitted: "Screen",
  resubmitted: "Screen",
  editorial_screening: "Assign",
  under_review: "Review",
  approved: "Publish",
};

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/editor/articles?status=editorial_screening", label: "Assign reviewer", icon: UserPlus },
  { href: "/dashboard/editor/articles?status=under_review", label: "Review decisions", icon: Search },
  { href: "/dashboard/editor/users", label: "Manage users", icon: Users },
  { href: "/dashboard/editor/categories", label: "Add category", icon: Tags },
  { href: "/dashboard/editor/moderation", label: "Moderate comments", icon: MessageSquare },
];

export default function EditorDashboard() {
  const { data, error, loading, reload } = useApiQuery<{ data: EditorOverview }>("/admin/overview");
  const recent = useApiQuery<Paginated<EditorArticleRow>>("/admin/articles?limit=6");
  const overview = data?.data;
  const rows = (recent.data?.data ?? []).filter((row) => row.status !== "draft");

  return (
    <RoleGuard role="editor">
      <PageTitle title="Editor dashboard" description="Manage submissions and the editorial workflow." />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {overview ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label="New submissions" value={overview.newSubmissions} icon={Inbox} href="/dashboard/editor/articles?status=submitted" />
            <StatCard label="Awaiting assignment" value={overview.awaitingAssignment} icon={UserPlus} tone="amber" href="/dashboard/editor/articles?status=editorial_screening" />
            <StatCard label="Revision requested" value={overview.revisionRequests} icon={PenLine} tone="red" href="/dashboard/editor/articles?status=revision_requested" />
            <StatCard label="Published" value={overview.published} icon={CircleCheck} tone="teal" href="/dashboard/editor/articles?status=published" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Article submissions" action={{ href: "/dashboard/editor/articles", label: "View all" }}>
              {recent.loading ? <LoadingSkeleton rows={3} /> : null}
              {recent.error ? <ErrorState message={recent.error} onRetry={recent.reload} /> : null}
              {recent.data && rows.length === 0 ? <p className="text-sm text-muted-foreground">No submissions yet.</p> : null}
              {rows.length > 0 ? (
                <DataTable
                  bare
                  caption="Recently updated submissions"
                  rows={rows}
                  rowKey={(row) => row._id}
                  columns={[
                    {
                      header: "Title",
                      className: "whitespace-normal min-w-48",
                      cell: (row) => (
                        <Link href={`/dashboard/editor/articles/${row._id}`} className="font-medium text-primary hover:underline">{row.title}</Link>
                      ),
                    },
                    { header: "Author", cell: (row) => row.author?.name ?? "Unknown" },
                    { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                    {
                      header: "Action",
                      className: "text-right",
                      cell: (row) => {
                        const action = NEXT_ACTION[row.status];
                        return (
                          <Link
                            href={`/dashboard/editor/articles/${row._id}`}
                            aria-label={`${action ?? "View"} ${row.title}`}
                            className={cn(
                              buttonVariants({ variant: action ? "default" : "outline", size: "sm" }),
                              "min-w-16",
                              action === "Assign" && "bg-brand-teal-strong hover:bg-brand-teal-strong/85",
                            )}
                          >
                            {action ?? "View"}
                          </Link>
                        );
                      },
                    },
                  ]}
                />
              ) : null}
            </Panel>

            <Panel title="Needs attention">
              <ul className="flex flex-col">
                {ATTENTION.map((item) => (
                  <li key={item.key} className="border-b last:border-b-0">
                    <Link href={item.href} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-teal-strong">
                      <span>{item.label}</span>
                      <span
                        className={cn(
                          "min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold",
                          overview[item.key] > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {overview[item.key]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Quick actions">
            <div className="flex flex-wrap gap-3">
              {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
                <Link key={label} href={href} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 px-4")}>
                  <Icon aria-hidden="true" className="text-brand-teal-strong" />
                  {label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}
    </RoleGuard>
  );
}
