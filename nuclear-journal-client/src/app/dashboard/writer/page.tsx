"use client";

import { CircleCheck, Clock, FileText, PenLine } from "lucide-react";
import Link from "next/link";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PageTitle, Panel, RoleGuard, StatCard } from "@/components/dashboard/dashboard-shell";
import { WriterArticleTable } from "@/components/writer/writer-article-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import type { Paginated, WriterArticle, WriterStatus } from "@/lib/types";

type WriterStats = Record<WriterStatus, number> & { total: number };

export default function WriterDashboard() {
  const stats = useApiQuery<{ data: WriterStats }>("/writer/stats");
  const articles = useApiQuery<Paginated<WriterArticle>>("/writer/articles?limit=5");
  const counts = stats.data?.data;
  const rows = articles.data?.data ?? [];

  return (
    <RoleGuard role="writer">
      <PageTitle
        title="Writer dashboard"
        description="Manage your articles and track their progress."
        action={<Link href="/dashboard/writer/articles/new" className={buttonVariants({ size: "lg" })}>New article</Link>}
      />
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Total articles" value={counts?.total ?? "–"} icon={FileText} href="/dashboard/writer/articles" />
          <StatCard label="Pending review" value={counts?.pending_review ?? "–"} icon={Clock} tone="amber" />
          <StatCard label="Revision requested" value={counts?.revision_requested ?? "–"} icon={PenLine} tone="red" />
          <StatCard label="Published" value={counts?.published ?? "–"} icon={CircleCheck} tone="teal" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="My articles" action={{ href: "/dashboard/writer/articles", label: "View all" }}>
            {articles.loading ? <LoadingSkeleton rows={3} /> : null}
            {articles.error ? <ErrorState message={articles.error} onRetry={articles.reload} /> : null}
            {articles.data && rows.length === 0 ? (
              <EmptyState
                title="You haven't written anything yet"
                action={<Link href="/dashboard/writer/articles/new" className={buttonVariants()}>Start your first article</Link>}
              />
            ) : null}
            {rows.length > 0 ? <WriterArticleTable rows={rows} bare /> : null}
          </Panel>
          <Panel title="Recent activity" action={{ href: "/dashboard/notifications", label: "All" }}>
            <ActivityFeed />
          </Panel>
        </div>
      </div>
    </RoleGuard>
  );
}
