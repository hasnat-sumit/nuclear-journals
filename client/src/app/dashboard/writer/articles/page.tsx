"use client";

import Link from "next/link";
import { useState } from "react";
import { PagerButtons, PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { WriterArticleTable } from "@/components/writer/writer-article-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { buttonVariants } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import type { Paginated, WriterArticle } from "@/lib/types";

export default function WriterArticles() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApiQuery<Paginated<WriterArticle>>(`/writer/articles?limit=20&page=${page}`);
  const rows = data?.data ?? [];

  return (
    <RoleGuard role="writer">
      <PageTitle
        title="My articles"
        description="Every article you have started, newest first."
        action={<Link href="/dashboard/writer/articles/new" className={buttonVariants({ size: "lg" })}>New article</Link>}
      />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? (
        rows.length === 0 ? (
          <EmptyState
            title="You haven't written anything yet"
            action={<Link href="/dashboard/writer/articles/new" className={buttonVariants()}>Start your first article</Link>}
          />
        ) : (
          <>
            <WriterArticleTable rows={rows} showDetails />
            <PagerButtons page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
          </>
        )
      ) : null}
    </RoleGuard>
  );
}
