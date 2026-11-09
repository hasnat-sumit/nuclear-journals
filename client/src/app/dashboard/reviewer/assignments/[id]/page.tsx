"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/dashboard/dashboard-shell";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Field } from "@/components/form-field";
import { ReviewForm } from "@/components/reviewer/review-form";
import { ArticleArt } from "@/components/site/artwork";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate, humanize } from "@/lib/format";
import type { ReviewerAssignmentDetail } from "@/lib/types";

function InvitationActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState(false);
  const [declining, setDeclining] = useState(false);

  async function accept() {
    try {
      await api.post(`/reviewer/assignments/${id}/accept`);
      toast.success("Assignment accepted");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function decline(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.post(`/reviewer/assignments/${id}/decline`, { reason, conflictOfInterest: conflict });
      toast.success("Assignment declined");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section aria-label="Respond to invitation" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      {declining ? (
        <form onSubmit={decline} className="flex flex-col gap-3">
          <Field label="Why are you declining?" htmlFor="reason" hint="Seen only by the editors. The writer is never told.">
            <Textarea id="reason" value={reason} minLength={5} required onChange={(event) => setReason(event.target.value)} />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={conflict} onCheckedChange={setConflict} />
            I have a conflict of interest with this article&apos;s author. Don&apos;t invite me to review their work again.
          </label>
          <div className="flex gap-3">
            <Button type="submit" variant="destructive">Decline assignment</Button>
            <Button type="button" variant="ghost" onClick={() => setDeclining(false)}>Back</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void accept()}>Accept assignment</Button>
          <Button variant="outline" onClick={() => setDeclining(true)}>Decline</Button>
        </div>
      )}
    </section>
  );
}

export default function ReviewerAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApiQuery<{ data: ReviewerAssignmentDetail }>(`/reviewer/assignments/${id}`);
  const assignment = data?.data;
  const canRespond = assignment?.status === "invited";
  const canReview = assignment && ["accepted", "in_progress", "overdue"].includes(assignment.status);

  return (
    <RoleGuard role="reviewer">
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {assignment ? (
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-start gap-5 rounded-xl border bg-card p-5">
            <div className="aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg">
              <ArticleArt seed={assignment.id} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Review article</p>
              <h1 className="text-2xl leading-tight font-bold sm:text-3xl">{assignment.article.title}</h1>
              <p className="text-sm text-muted-foreground">
                {assignment.article.category ? `Category: ${assignment.article.category.name} · ` : ""}
                Due {formatDate(assignment.dueDate)} · Round {assignment.article.reviewRound} · {assignment.article.readingTime} min read
              </p>
              <div><StatusBadge status={assignment.status} /></div>
            </div>
          </header>
          {canRespond ? <InvitationActions id={assignment.id} onDone={reload} /> : null}

          <article aria-label="Article under review" className="rounded-xl border bg-card p-6 md:p-8">
            <p className="mb-4 text-lg text-muted-foreground">{assignment.article.excerpt}</p>
            {/* Sanitized by the server before storage. */}
            <div className="article-body" dangerouslySetInnerHTML={{ __html: assignment.article.contentHtml }} />
            {assignment.article.references.length > 0 ? (
              <>
                <h2 className="mt-8 text-xl font-semibold">References</h2>
                <ol className="mt-2 list-decimal pl-5 text-sm leading-6">
                  {assignment.article.references.map((reference, index) => <li key={index}>{reference.citation}</li>)}
                </ol>
              </>
            ) : null}
          </article>

          {canReview ? (
            <section aria-labelledby="review-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-6 md:p-8">
              <div>
                <h2 id="review-heading" className="text-2xl font-semibold">Your review</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Score each criterion from 1 to 5. Your recommendation is advisory: the editor makes the final decision.
                </p>
              </div>
              <ReviewForm assignment={assignment} onDone={reload} />
            </section>
          ) : null}

          {assignment.review?.status === "submitted" ? (
            <section aria-label="Submitted review" className="rounded-lg border bg-card p-5">
              <p className="font-medium">Submitted {formatDate(assignment.review.submittedAt)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Recommendation: {humanize(assignment.review.recommendation ?? "none")}</p>
              <p className="mt-3 leading-7 whitespace-pre-wrap">{assignment.review.comments}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </RoleGuard>
  );
}
