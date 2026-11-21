"use client";

import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { useApiQuery } from "@/hooks/use-api-query";
import { formatDate, humanize } from "@/lib/format";

interface Reviewer {
  id: string;
  name: string;
  email: string;
  available: boolean;
  unavailableUntil: string | null;
  unavailableReason: string;
  expertise: { name: string; proficiency: string }[];
  workload: number;
  maxPendingReviews: number;
}

export default function ReviewerWorkloadPage() {
  const { data, error, loading, reload } = useApiQuery<{ data: Reviewer[] }>("/admin/reviewers");
  return (
    <RoleGuard role="editor">
      <PageTitle title="Reviewer workload" />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No approved reviewers yet" /> : null}
      {data && data.data.length > 0 ? (
        <DataTable
          caption="Reviewer workload"
          rows={data.data}
          rowKey={(row) => row.id}
          columns={[
            { header: "Reviewer", cell: (row) => <><p className="font-medium">{row.name}</p><p className="text-muted-foreground">{row.email}</p></> },
            { header: "Workload", cell: (row) => `${row.workload} of ${row.maxPendingReviews}` },
            {
              header: "Availability",
              className: "whitespace-normal",
              cell: (row) => row.available ? "Available" : (
                <>
                  Unavailable{row.unavailableUntil ? ` until ${formatDate(row.unavailableUntil)}` : ""}
                  {row.unavailableReason ? <p className="text-muted-foreground">{row.unavailableReason}</p> : null}
                </>
              ),
            },
            { header: "Expertise", className: "whitespace-normal", cell: (row) => row.expertise.map((item) => `${item.name} (${humanize(item.proficiency)})`).join(", ") || "None set" },
          ]}
        />
      ) : null}
    </RoleGuard>
  );
}
