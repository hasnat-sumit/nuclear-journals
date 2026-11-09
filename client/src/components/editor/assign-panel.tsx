"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { humanize } from "@/lib/format";
import type { ReviewerEvaluation } from "@/lib/types";

export function AssignPanel({ articleId, onChanged }: { articleId: string; onChanged: () => void }) {
  const { data, error, loading, reload } = useApiQuery<{ data: ReviewerEvaluation[] }>(`/admin/articles/${articleId}/eligible-reviewers`);
  const [selected, setSelected] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const reviewers = data?.data ?? [];
  const selectedIneligible = reviewers.filter((item) => selected.includes(item.reviewerId) && !item.eligible);
  const needsOverride = selectedIneligible.length > 0;

  async function assign(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const result = await api.post<{ data: { assigned: string[] }; message?: string }>(`/admin/articles/${articleId}/assign-reviewers`, {
        ...body,
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
      });
      if (result.data.assigned.length > 0) toast.success(`Assigned ${result.data.assigned.length} reviewer(s)`);
      else toast.warning(result.message ?? "No eligible reviewer found.");
      setSelected([]);
      setOverrideReason("");
      reload();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <section aria-labelledby="assign-heading" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <h2 id="assign-heading" className="text-xl font-semibold">Assign reviewers</h2>
      <div className="flex flex-wrap items-end gap-3">
        <Button disabled={busy} onClick={() => void assign({ mode: "automatic", count: 1 })}>Assign automatically</Button>
        <Field label="Due date (default 14 days)" htmlFor="due-date">
          <Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
      </div>

      {reviewers.length === 0 ? <p className="text-sm text-muted-foreground">No approved reviewers yet.</p> : null}
      <ul className="flex flex-col divide-y">
        {reviewers.map((reviewer) => (
          <li key={reviewer.reviewerId} className="flex items-start gap-3 py-3">
            <Checkbox
              aria-label={`Select ${reviewer.name}`}
              className="mt-1"
              disabled={reviewer.blocked}
              checked={selected.includes(reviewer.reviewerId)}
              onCheckedChange={(checked) =>
                setSelected(checked ? [...selected, reviewer.reviewerId] : selected.filter((id) => id !== reviewer.reviewerId))
              }
            />
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {reviewer.name} <span className="font-normal text-muted-foreground">{reviewer.email}</span>
              </p>
              <p className="text-muted-foreground">
                {reviewer.proficiency ? humanize(reviewer.proficiency) : "No matching expertise"} · Workload {reviewer.workload} of {reviewer.maxPendingReviews}
              </p>
              {reviewer.eligible ? (
                <p className="text-brand-teal">Eligible</p>
              ) : (
                <p className="text-amber-800">{reviewer.reasons.join(" · ")}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {needsOverride ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlert aria-hidden="true" className="size-4" /> You are overriding the assignment rules
          </p>
          <ul className="list-disc pl-5 text-sm">
            {selectedIneligible.map((item) => <li key={item.reviewerId}>{item.name}: {item.reasons.join("; ")}</li>)}
          </ul>
          <Field label="Reason for override (recorded in the audit log)" htmlFor="override-reason">
            <Textarea id="override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
          </Field>
        </div>
      ) : null}

      <div>
        <Button
          variant="outline"
          disabled={busy || selected.length === 0 || (needsOverride && overrideReason.trim().length < 5)}
          onClick={() => void assign({ mode: "manual", reviewerIds: selected, ...(needsOverride ? { overrideReason } : {}) })}
        >
          Assign selected ({selected.length})
        </Button>
      </div>
    </section>
  );
}
