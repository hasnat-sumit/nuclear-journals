"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PagerButtons, PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate, humanize } from "@/lib/format";
import type { Paginated } from "@/lib/types";

interface CommentRow {
  _id: string;
  content: string;
  createdAt: string;
  user: { name: string; email: string } | null;
  article: { title: string; slug: string } | null;
}

interface RatingRow {
  _id: string;
  targetType: string;
  score: number;
  status: "visible" | "hidden";
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function ModerationPage() {
  const [commentPage, setCommentPage] = useState(1);
  const [ratingPage, setRatingPage] = useState(1);
  const comments = useApiQuery<Paginated<CommentRow>>(`/admin/comments?status=pending&page=${commentPage}`);
  const ratings = useApiQuery<Paginated<RatingRow>>(`/admin/ratings?page=${ratingPage}`);

  async function moderateComment(id: string, status: "approved" | "rejected") {
    try {
      await api.patch(`/admin/comments/${id}`, { status });
      comments.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function moderateRating(id: string, status: "visible" | "hidden") {
    try {
      await api.patch(`/admin/ratings/${id}`, { status });
      ratings.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <RoleGuard role="editor">
      <PageTitle title="Moderation" />
      <div className="flex flex-col gap-10">
        <section aria-labelledby="comments-heading" className="flex flex-col gap-3">
          <h2 id="comments-heading" className="text-xl font-semibold">Comments awaiting review</h2>
          {comments.loading ? <LoadingSkeleton rows={2} /> : null}
          {comments.error ? <ErrorState message={comments.error} onRetry={comments.reload} /> : null}
          {comments.data?.data.length === 0 ? <EmptyState title="No comments waiting" /> : null}
          <ul className="flex flex-col gap-3">
            {comments.data?.data.map((row) => (
              <li key={row._id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {row.user?.name ?? "Unknown"} ({row.user?.email}) on &quot;{row.article?.title}&quot; · {formatDate(row.createdAt)}
                </p>
                <p className="leading-7 whitespace-pre-wrap">{row.content}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void moderateComment(row._id, "approved")}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => void moderateComment(row._id, "rejected")}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
          {comments.data ? <PagerButtons page={commentPage} totalPages={comments.data.pagination.totalPages} onChange={setCommentPage} /> : null}
        </section>

        <section aria-labelledby="ratings-heading" className="flex flex-col gap-3">
          <h2 id="ratings-heading" className="text-xl font-semibold">Ratings</h2>
          {ratings.loading ? <LoadingSkeleton rows={2} /> : null}
          {ratings.error ? <ErrorState message={ratings.error} onRetry={ratings.reload} /> : null}
          {ratings.data?.data.length === 0 ? <EmptyState title="No ratings yet" /> : null}
          {ratings.data && ratings.data.data.length > 0 ? (
            <>
              <DataTable
                caption="Ratings"
                rows={ratings.data.data}
                rowKey={(row) => row._id}
                columns={[
                  { header: "From", cell: (row) => row.user?.name ?? "Unknown" },
                  { header: "Target", cell: (row) => humanize(row.targetType) },
                  { header: "Score", cell: (row) => `${row.score} of 5` },
                  { header: "Date", cell: (row) => formatDate(row.createdAt) },
                  { header: "Status", cell: (row) => humanize(row.status) },
                  {
                    header: "Action",
                    cell: (row) => (
                      <Button size="sm" variant="outline" onClick={() => void moderateRating(row._id, row.status === "visible" ? "hidden" : "visible")}>
                        {row.status === "visible" ? "Hide" : "Show"}
                      </Button>
                    ),
                  },
                ]}
              />
              <PagerButtons page={ratingPage} totalPages={ratings.data.pagination.totalPages} onChange={setRatingPage} />
            </>
          ) : null}
        </section>
      </div>
    </RoleGuard>
  );
}
