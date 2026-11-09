"use client";

import Link from "next/link";
import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { StatusBadge } from "@/components/status-badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatDate } from "@/lib/format";
import type { AssignmentStatus, ReviewerAssignmentSummary, ReviewerProfile } from "@/lib/types";

function AssignmentCard({ assignment }: { assignment: ReviewerAssignmentSummary }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
      <div>
        <Link href={`/dashboard/reviewer/assignments/${assignment.id}`} className="font-medium text-primary hover:underline">
          {assignment.articleTitle}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          Due {formatDate(assignment.dueDate)} · Round {assignment.reviewRound}
        </p>
      </div>
      <StatusBadge status={assignment.status} />
    </li>
  );
}

const GROUPS: { title: string; statuses: AssignmentStatus[] }[] = [
  { title: "Pending invitations", statuses: ["invited"] },
  { title: "Overdue", statuses: ["overdue"] },
  { title: "Accepted and in progress", statuses: ["accepted", "in_progress"] },
  { title: "Completed", statuses: ["completed"] },
  { title: "Past invitations", statuses: ["declined", "cancelled"] },
];

export default function ReviewerReviews() {
  const { data, error, loading, reload } = useApiQuery<{ data: ReviewerAssignmentSummary[] }>("/reviewer/assignments");
  const profile = useApiQuery<{ data: ReviewerProfile }>("/reviewer/profile");
  const available = profile.data?.data.availability === "available";

  return (
    <RoleGuard role="reviewer">
      <PageTitle title="My reviews" description="Every review invitation you have received, grouped by status." />
      {profile.data && !available ? (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          You are currently unavailable, so you will not receive automatic invitations.{" "}
          <Link href="/dashboard/reviewer/settings" className="font-medium underline underline-offset-2">Update your review settings</Link>.
        </p>
      ) : null}
      {profile.data ? (
        <p className="mb-6 text-sm text-muted-foreground">
          Current workload: {profile.data.data.workload} of {profile.data.data.maxPendingReviews} pending reviews.
        </p>
      ) : null}
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No assignments yet" description="Invitations from the editors will appear here." /> : null}
      <div className="flex flex-col gap-8">
        {GROUPS.map((group) => {
          const items = data?.data.filter((item) => group.statuses.includes(item.status)) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{group.title}</h2>
              <ul className="flex flex-col gap-2">
                {items.map((item) => <AssignmentCard key={item.id} assignment={item} />)}
              </ul>
            </section>
          );
        })}
      </div>
    </RoleGuard>
  );
}
