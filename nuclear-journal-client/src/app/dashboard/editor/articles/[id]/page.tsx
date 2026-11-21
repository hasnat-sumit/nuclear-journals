"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { AssignPanel } from "@/components/editor/assign-panel";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Field } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate, humanize } from "@/lib/format";
import type { ArticleStatus, EditorArticleDetail } from "@/lib/types";

const CAN_ASSIGN: ArticleStatus[] = ["submitted", "resubmitted", "editorial_screening", "under_review"];
const CAN_DECIDE: ArticleStatus[] = ["submitted", "resubmitted", "editorial_screening", "under_review"];

const CRITERIA_LABELS: Record<string, string> = {
  technicalAccuracy: "Technical accuracy",
  clarity: "Clarity",
  relevance: "Relevance",
  references: "References",
  overall: "Overall",
};

function DecisionPanel({ articleId, status, onChanged }: { articleId: string; status: ArticleStatus; onChanged: () => void }) {
  const [feedback, setFeedback] = useState("");

  async function run(action: string, body: unknown = {}) {
    try {
      await api.post(`/admin/articles/${articleId}/${action}`, body);
      toast.success("Done");
      setFeedback("");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const canDecide = CAN_DECIDE.includes(status) || status === "approved";
  const feedbackReady = feedback.trim().length >= 10;

  return (
    <section aria-labelledby="decision-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <h2 id="decision-heading" className="text-xl font-semibold">Editorial decision</h2>
      {status === "submitted" || status === "resubmitted" ? (
        <div><Button variant="outline" onClick={() => void run("start-screening")}>Start screening</Button></div>
      ) : null}
      {canDecide ? (
        <>
          <Field label="Feedback released to the writer" htmlFor="feedback" hint="Only this text reaches the writer. Required to request a revision or reject.">
            <Textarea id="feedback" rows={5} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {CAN_DECIDE.includes(status) ? (
              <Button onClick={() => void run("approve", { feedback: feedback || undefined })}>Approve</Button>
            ) : null}
            <Button variant="outline" disabled={!feedbackReady} onClick={() => void run("request-revision", { feedback })}>Request revision</Button>
            <ConfirmationDialog
              trigger={<Button variant="destructive" disabled={!feedbackReady}>Reject</Button>}
              title="Reject this article?"
              description="The writer will be told the decision and shown your feedback."
              confirmLabel="Reject"
              onConfirm={() => void run("reject", { feedback })}
            />
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {status === "approved" || status === "unpublished" ? <Button onClick={() => void run("publish")}>Publish</Button> : null}
        {status === "published" ? (
          <>
            <Button variant="outline" onClick={() => void run("feature", { featured: true })}>Feature</Button>
            <Button variant="outline" onClick={() => void run("feature", { featured: false })}>Remove feature</Button>
            <ConfirmationDialog
              trigger={<Button variant="outline">Unpublish</Button>}
              title="Unpublish this article?"
              description="It will stop being publicly visible."
              confirmLabel="Unpublish"
              onConfirm={() => void run("unpublish")}
            />
          </>
        ) : null}
        {["published", "unpublished", "approved", "rejected"].includes(status) ? (
          <ConfirmationDialog
            trigger={<Button variant="outline">Archive</Button>}
            title="Archive this article?"
            description="It will be removed from public view."
            confirmLabel="Archive"
            onConfirm={() => void run("archive")}
          />
        ) : null}
      </div>
    </section>
  );
}

export default function EditorArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApiQuery<{ data: EditorArticleDetail }>(`/admin/articles/${id}`);
  const detail = data?.data;

  async function cancelAssignment(assignmentId: string) {
    try {
      await api.post(`/admin/assignments/${assignmentId}/cancel`);
      toast.success("Assignment cancelled");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <RoleGuard role="editor">
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {detail ? (
        <div className="flex flex-col gap-8">
          <PageTitle
            title={detail.article.title}
            description={`By ${detail.article.author?.name ?? "Unknown"} (${detail.article.author?.email ?? ""}) · ${detail.article.category?.name ?? "No category"} · Round ${detail.article.reviewRound}`}
            action={<StatusBadge status={detail.article.status} />}
          />
          {detail.article.status === "published" ? (
            <Link href={`/articles/${detail.article.slug}`} className="text-sm font-medium text-brand-teal hover:underline">View public page</Link>
          ) : null}

          <DecisionPanel articleId={id} status={detail.article.status} onChanged={reload} />
          {CAN_ASSIGN.includes(detail.article.status) ? <AssignPanel articleId={id} onChanged={reload} /> : null}

          <section aria-labelledby="assignments-heading" className="flex flex-col gap-3">
            <h2 id="assignments-heading" className="text-xl font-semibold">Assignment history</h2>
            {detail.assignments.length === 0 ? <p className="text-sm text-muted-foreground">No reviewers assigned yet.</p> : (
              <DataTable
                caption="Assignment history"
                rows={detail.assignments}
                rowKey={(row) => row._id}
                columns={[
                  { header: "Reviewer", cell: (row) => row.reviewer?.name ?? "Unknown" },
                  { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                  { header: "Round", cell: (row) => row.reviewRound },
                  { header: "Type", cell: (row) => humanize(row.assignmentType) },
                  { header: "Due", cell: (row) => formatDate(row.dueDate) },
                  {
                    header: "Notes",
                    className: "whitespace-normal",
                    cell: (row) => (
                      <>
                        {row.declineReason ? <p>Declined: {row.declineReason}</p> : null}
                        {row.overrideReason ? <p>Override: {row.overrideReason}</p> : null}
                      </>
                    ),
                  },
                  {
                    header: "Action",
                    cell: (row) =>
                      ["invited", "accepted", "in_progress", "overdue"].includes(row.status) ? (
                        <Button size="sm" variant="ghost" onClick={() => void cancelAssignment(row._id)}>Cancel</Button>
                      ) : null,
                  },
                ]}
              />
            )}
          </section>

          <section aria-labelledby="reviews-heading" className="flex flex-col gap-3">
            <h2 id="reviews-heading" className="text-xl font-semibold">Submitted reviews</h2>
            <p className="text-sm text-muted-foreground">Confidential. Writers cannot see these.</p>
            {detail.reviews.length === 0 ? <p className="text-sm text-muted-foreground">No reviews submitted yet.</p> : null}
            {detail.reviews.map((review) => (
              <article key={review._id} className="rounded-lg border bg-card p-5">
                <p className="font-medium">{review.reviewer?.name} · Round {review.reviewRound} · {formatDate(review.submittedAt)}</p>
                <p className="mt-1 text-sm">Recommendation: <strong>{humanize(review.recommendation)}</strong></p>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {Object.entries(review.criteria).map(([key, value]) => (
                    <div key={key} className="flex gap-1"><dt>{CRITERIA_LABELS[key] ?? key}:</dt><dd>{value}/5</dd></div>
                  ))}
                </dl>
                <p className="mt-3 leading-7 whitespace-pre-wrap">{review.comments}</p>
              </article>
            ))}
          </section>

          <section aria-labelledby="content-heading" className="flex flex-col gap-3">
            <h2 id="content-heading" className="text-xl font-semibold">Article</h2>
            <div className="rounded-lg border bg-card p-6">
              <p className="mb-4 text-muted-foreground">{detail.article.excerpt}</p>
              {/* Sanitized by the server before storage. */}
              <div className="article-body" dangerouslySetInnerHTML={{ __html: detail.article.content.html }} />
              {detail.article.references.length > 0 ? (
                <ol className="mt-6 list-decimal pl-5 text-sm leading-6">
                  {detail.article.references.map((reference, index) => <li key={index}>{reference.citation}</li>)}
                </ol>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="history-heading" className="flex flex-col gap-3">
            <h2 id="history-heading" className="text-xl font-semibold">Activity</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {detail.logs.map((log) => (
                <li key={log._id} className="border-t py-2">
                  <strong>{humanize(log.action)}</strong> by {log.actor?.name ?? "Unknown"} · {formatDate(log.createdAt)}
                  {log.newStatus ? <span className="text-muted-foreground"> · {humanize(log.previousStatus ?? "")} to {humanize(log.newStatus)}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </RoleGuard>
  );
}
