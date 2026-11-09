"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PagerButtons, PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { StatusBadge } from "@/components/status-badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatDate, humanize } from "@/lib/format";
import type { ArticleStatus, EditorArticleRow, Paginated } from "@/lib/types";

const STATUSES: ArticleStatus[] = [
  "submitted", "resubmitted", "editorial_screening", "under_review", "revision_requested",
  "approved", "published", "rejected", "unpublished", "archived", "draft",
];

function ArticleList() {
  const initial = useSearchParams().get("status") ?? "";
  const [status, setStatus] = useState(initial);
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  const { data, error, loading, reload } = useApiQuery<Paginated<EditorArticleRow>>(`/admin/articles?${query.toString()}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label htmlFor="status-filter" className="text-sm font-medium">Status</label>
        <NativeSelect id="status-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <NativeSelectOption value="">All</NativeSelectOption>
          {STATUSES.map((item) => <NativeSelectOption key={item} value={item}>{humanize(item)}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No articles here" /> : null}
      {data && data.data.length > 0 ? (
        <>
          <DataTable
            caption="Articles"
            rows={data.data}
            rowKey={(row) => row._id}
            columns={[
              { header: "Title", className: "whitespace-normal", cell: (row) => <Link href={`/dashboard/editor/articles/${row._id}`} className="font-medium text-primary hover:underline">{row.title}</Link> },
              { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
              { header: "Author", cell: (row) => row.author?.name ?? "Unknown" },
              { header: "Category", cell: (row) => row.category?.name ?? "None" },
              { header: "Updated", cell: (row) => formatDate(row.updatedAt) },
            ]}
          />
          <PagerButtons page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      ) : null}
    </div>
  );
}

export default function EditorArticlesPage() {
  return (
    <RoleGuard role="editor">
      <PageTitle title="Articles" />
      <Suspense fallback={<LoadingSkeleton />}>
        <ArticleList />
      </Suspense>
    </RoleGuard>
  );
}
