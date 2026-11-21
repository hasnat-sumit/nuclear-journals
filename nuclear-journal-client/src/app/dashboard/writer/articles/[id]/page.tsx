"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ArticleForm } from "@/components/writer/article-form";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate, humanize } from "@/lib/format";
import type { Feedback, Revision, WriterArticle, WriterStatus } from "@/lib/types";

const STATUS_HELP: Partial<Record<WriterStatus, string>> = {
  pending_review: "The editorial team is working on your article. You will be told when there is a decision.",
  revision_requested: "Please read the feedback below, make your changes and resubmit.",
  approved: "Your article is approved and awaiting publication.",
  rejected: "The editorial team decided not to publish this article.",
  unpublished: "This article is no longer publicly visible.",
  archived: "This article has been archived.",
};

export default function WriterArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const article = useApiQuery<{ data: WriterArticle }>(`/writer/articles/${id}`);
  const feedback = useApiQuery<{ data: Feedback[] }>(`/writer/articles/${id}/feedback`);
  const revisions = useApiQuery<{ data: Revision[] }>(`/writer/articles/${id}/revisions`);

  function refresh() {
    article.reload();
    feedback.reload();
    revisions.reload();
  }

  async function removeDraft() {
    try {
      await api.delete(`/writer/articles/${id}`);
      toast.success("Draft deleted");
      router.replace("/dashboard/writer");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const current = article.data?.data;
  const editable = current?.status === "draft" || current?.status === "revision_requested";

  return (
    <RoleGuard role="writer">
      {article.loading ? <LoadingSkeleton /> : null}
      {article.error ? <ErrorState message={article.error} onRetry={article.reload} /> : null}
      {current ? (
        <div className="flex flex-col gap-8">
          <PageTitle
            title={current.title}
            action={
              current.status === "draft" ? (
                <ConfirmationDialog
                  trigger={<Button variant="destructive">Delete draft</Button>}
                  title="Delete this draft?"
                  description="This cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={() => void removeDraft()}
                />
              ) : undefined
            }
          />
          <div className="flex flex-col items-start gap-2">
            <StatusBadge status={current.status} />
            {STATUS_HELP[current.status] ? <p className="text-muted-foreground">{STATUS_HELP[current.status]}</p> : null}
            {current.status === "published" ? (
              <Link href={`/articles/${current.slug}`} className="text-sm font-medium text-brand-teal hover:underline">View published article</Link>
            ) : null}
          </div>

          {feedback.data && feedback.data.data.length > 0 ? (
            <section aria-labelledby="feedback-heading" className="flex flex-col gap-3">
              <h2 id="feedback-heading" className="text-xl font-semibold">Editorial feedback</h2>
              <ul className="flex flex-col gap-3">
                {feedback.data.data.map((item) => (
                  <li key={item.id} className="rounded-lg border bg-card p-4">
                    <p className="text-sm font-medium">{humanize(item.decision)} · {formatDate(item.createdAt)}</p>
                    {item.message ? <p className="mt-2 leading-7 whitespace-pre-wrap">{item.message}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {editable ? (
            <ArticleForm key={`${current.id}-${current.status}`} article={current} onSaved={refresh} />
          ) : (
            <section aria-label="Article preview" className="rounded-lg border bg-card p-6">
              <p className="mb-4 text-muted-foreground">{current.excerpt}</p>
              {/* Sanitized by the server before storage. */}
              <div className="article-body" dangerouslySetInnerHTML={{ __html: current.contentHtml }} />
            </section>
          )}

          {revisions.data && revisions.data.data.length > 0 ? (
            <section aria-labelledby="revisions-heading" className="flex flex-col gap-3">
              <h2 id="revisions-heading" className="text-xl font-semibold">Revision history</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {revisions.data.data.map((item) => (
                  <li key={item.id} className="border-t pt-2">
                    <strong>Version {item.version}</strong> · {formatDate(item.createdAt)}: {item.changeSummary}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </RoleGuard>
  );
}
