"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WriterArticle } from "@/lib/types";

const EDITABLE = new Set(["draft", "revision_requested"]);

// Shows only writer-safe fields: the simplified status and the writer's own dates.
export function WriterArticleTable({ rows, showDetails = false, bare = false }: { rows: WriterArticle[]; showDetails?: boolean; bare?: boolean }) {
  const columns: Column<WriterArticle>[] = [
    {
      header: "Title",
      className: "whitespace-normal min-w-48",
      cell: (row) => (
        <Link href={`/dashboard/writer/articles/${row.id}`} className="font-medium text-primary hover:underline">
          {row.title}
        </Link>
      ),
    },
    { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    ...(showDetails ? [{ header: "Category", cell: (row: WriterArticle) => row.category?.name ?? "None" }] : []),
    { header: "Submitted", cell: (row) => formatShortDate(row.submittedAt) || (row.status === "draft" ? "Not yet" : "—") },
    ...(showDetails
      ? [
          { header: "Last edited", cell: (row: WriterArticle) => formatShortDate(row.lastEditedAt) },
          { header: "Views", cell: (row: WriterArticle) => row.viewCount },
        ]
      : []),
    {
      header: "Action",
      className: "text-right",
      cell: (row) => (
        <Link
          href={`/dashboard/writer/articles/${row.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-w-14")}
          aria-label={`${EDITABLE.has(row.status) ? "Edit" : "View"} ${row.title}`}
        >
          {EDITABLE.has(row.status) ? "Edit" : "View"}
        </Link>
      ),
    },
  ];
  return <DataTable caption="Your articles" rows={rows} rowKey={(row) => row.id} columns={columns} bare={bare} />;
}
