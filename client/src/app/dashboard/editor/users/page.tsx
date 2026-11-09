"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { PagerButtons, PageTitle, RoleGuard, useMe } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate, humanize } from "@/lib/format";
import type { Paginated, Role } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

function UserTable() {
  const { me } = useMe();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApiQuery<Paginated<Row>>(`/admin/users?limit=25&page=${page}`);

  async function setActive(row: Row, isActive: boolean) {
    try {
      await api.patch(`/admin/users/${row.id}`, { isActive });
      toast.success(isActive ? "Account reactivated" : "Account deactivated");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <DataTable
        caption="Users"
        rows={data.data}
        rowKey={(row) => row.id}
        columns={[
          { header: "Name", cell: (row) => row.name },
          { header: "Email", cell: (row) => row.email },
          { header: "Role", cell: (row) => humanize(row.role) },
          { header: "Joined", cell: (row) => formatDate(row.createdAt) },
          { header: "Status", cell: (row) => (row.isActive === false ? "Deactivated" : "Active") },
          {
            header: "Action",
            cell: (row) => {
              if (row.id === me.id) return null;
              if (row.isActive === false) {
                return <Button size="sm" variant="outline" onClick={() => void setActive(row, true)}>Reactivate</Button>;
              }
              return (
                <ConfirmationDialog
                  trigger={<Button size="sm" variant="outline">Deactivate</Button>}
                  title={`Deactivate ${row.name}?`}
                  description="They will lose access immediately. You can reactivate them later."
                  confirmLabel="Deactivate"
                  onConfirm={() => void setActive(row, false)}
                />
              );
            },
          },
        ]}
      />
      <PagerButtons page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
    </>
  );
}

export default function UsersPage() {
  return (
    <RoleGuard role="editor">
      <PageTitle title="Users" />
      <UserTable />
    </RoleGuard>
  );
}
