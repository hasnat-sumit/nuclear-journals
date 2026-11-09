"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";

interface Row {
  _id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
}

export default function CategoriesAdminPage() {
  const { data, error, loading, reload } = useApiQuery<{ data: Row[] }>("/admin/categories");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.post("/admin/categories", { name, description, displayOrder: data?.data.length ?? 0 });
      toast.success("Category added");
      setName("");
      setDescription("");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function toggle(row: Row) {
    try {
      await api.patch(`/admin/categories/${row._id}`, { isActive: !row.isActive });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <RoleGuard role="editor">
      <PageTitle title="Categories" description="These are also the topics reviewers choose as expertise or exclusions." />
      <form onSubmit={create} className="mb-8 grid items-end gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_2fr_auto]">
        <Field label="Name" htmlFor="category-name">
          <Input id="category-name" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Description" htmlFor="category-description">
          <Input id="category-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Button type="submit">Add category</Button>
      </form>
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No categories yet" /> : null}
      {data && data.data.length > 0 ? (
        <DataTable
          caption="Categories"
          rows={data.data}
          rowKey={(row) => row._id}
          columns={[
            { header: "Name", cell: (row) => row.name },
            { header: "Description", className: "whitespace-normal", cell: (row) => row.description },
            { header: "Status", cell: (row) => row.isActive ? "Active" : "Hidden" },
            { header: "Action", cell: (row) => <Button size="sm" variant="outline" onClick={() => void toggle(row)}>{row.isActive ? "Hide" : "Show"}</Button> },
          ]}
        />
      ) : null}
    </RoleGuard>
  );
}
