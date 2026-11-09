"use client";

import { useState } from "react";
import { PagerButtons, PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatDate, humanize } from "@/lib/format";
import type { Paginated } from "@/lib/types";

interface Row {
  _id: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  createdAt: string;
  actor: { name: string } | null;
  article: { title: string } | null;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApiQuery<Paginated<Row>>(`/admin/logs?page=${page}`);
  return (
    <RoleGuard role="editor">
      <PageTitle title="Audit log" description="A permanent record of editorial activity." />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No activity yet" /> : null}
      {data && data.data.length > 0 ? (
        <>
          <DataTable
            caption="Audit log"
            rows={data.data}
            rowKey={(row) => row._id}
            columns={[
              { header: "Date", cell: (row) => formatDate(row.createdAt) },
              { header: "Who", cell: (row) => row.actor?.name ?? "Unknown" },
              { header: "Action", cell: (row) => humanize(row.action) },
              { header: "Article", className: "whitespace-normal", cell: (row) => row.article?.title ?? "" },
              { header: "Change", cell: (row) => (row.newStatus ? `${humanize(row.previousStatus ?? "")} to ${humanize(row.newStatus)}` : "") },
            ]}
          />
          <PagerButtons page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      ) : null}
    </RoleGuard>
  );
}
