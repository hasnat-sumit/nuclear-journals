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
import type { AssignmentStatus, Paginated } from "@/lib/types";

interface Row {
  _id: string;
  status: AssignmentStatus;
  dueDate: string;
  declineReason?: string;
  article: { _id: string; title: string } | null;
  reviewer: { name: string; email: string } | null;
}

const STATUSES: AssignmentStatus[] = ["invited", "accepted", "in_progress", "overdue", "completed", "declined", "cancelled"];

function AssignmentList() {
  const [status, setStatus] = useState(useSearchParams().get("status") ?? "");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), limit: "25" });
  if (status) query.set("status", status);
  const { data, error, loading, reload } = useApiQuery<Paginated<Row>>(`/admin/assignments?${query.toString()}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label htmlFor="assignment-status" className="text-sm font-medium">Status</label>
        <NativeSelect id="assignment-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <NativeSelectOption value="">All</NativeSelectOption>
          {STATUSES.map((item) => <NativeSelectOption key={item} value={item}>{humanize(item)}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No assignments here" /> : null}
      {data && data.data.length > 0 ? (
        <>
          <DataTable
            caption="Review assignments"
            rows={data.data}
            rowKey={(row) => row._id}
            columns={[
              { header: "Article", className: "whitespace-normal", cell: (row) => row.article ? <Link href={`/dashboard/editor/articles/${row.article._id}`} className="font-medium text-primary hover:underline">{row.article.title}</Link> : "Removed" },
              { header: "Reviewer", cell: (row) => row.reviewer?.name ?? "Unknown" },
              { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
              { header: "Due", cell: (row) => formatDate(row.dueDate) },
              { header: "Decline reason", className: "whitespace-normal", cell: (row) => row.declineReason ?? "" },
            ]}
          />
          <PagerButtons page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      ) : null}
    </div>
  );
}

export default function EditorAssignmentsPage() {
  return (
    <RoleGuard role="editor">
      <PageTitle title="Assignments" />
      <Suspense fallback={<LoadingSkeleton />}>
        <AssignmentList />
      </Suspense>
    </RoleGuard>
  );
}
