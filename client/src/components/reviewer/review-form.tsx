"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { ReviewerAssignmentDetail } from "@/lib/types";

const CRITERIA = [
  { key: "technicalAccuracy", label: "Technical accuracy" },
  { key: "clarity", label: "Clarity and readability" },
  { key: "relevance", label: "Relevance" },
  { key: "references", label: "Quality of references" },
  { key: "overall", label: "Overall quality" },
] as const;

const score = z.number({ error: "Choose a score" }).int().min(1).max(5);

const finalSchema = z.object({
  criteria: z.object({ technicalAccuracy: score, clarity: score, relevance: score, references: score, overall: score }),
  recommendation: z.enum(["accept", "minor_revision", "major_revision", "reject"], { error: "Choose a recommendation" }),
  comments: z.string().trim().min(50, "Please write at least 50 characters of feedback").max(10000),
});

type FormValues = {
  criteria: Partial<Record<(typeof CRITERIA)[number]["key"], number>>;
  recommendation: string;
  comments: string;
};

const SCORE_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

// Native radio buttons styled as stars, so arrow keys and screen readers work as usual.
function ScoreInput({ name, label, value, onChange, error }: { name: string; label: string; value?: number; onChange: (value: number) => void; error?: string }) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0">
      <legend className="float-left text-sm font-medium text-foreground">{label}</legend>
      <div className="flex items-center gap-3">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((option) => (
            <label key={option} className="cursor-pointer rounded p-0.5 has-focus-visible:ring-2 has-focus-visible:ring-ring">
              <input
                type="radio"
                name={name}
                value={option}
                className="sr-only"
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span className="sr-only">{`${option} out of 5, ${SCORE_WORDS[option]}`}</span>
              <Star
                aria-hidden="true"
                className={cn("size-6 text-amber-600 transition-colors", value !== undefined && option <= value ? "fill-amber-400" : "fill-transparent hover:fill-amber-100")}
              />
            </label>
          ))}
        </div>
        <span className="w-20 text-xs text-muted-foreground">{value ? SCORE_WORDS[value] : "Not scored"}</span>
      </div>
      {error ? <p role="alert" className="w-full text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}

const RECOMMENDATIONS = [
  { value: "accept", label: "Accept" },
  { value: "minor_revision", label: "Minor revision" },
  { value: "major_revision", label: "Major revision" },
  { value: "reject", label: "Reject" },
];

export function ReviewForm({ assignment, onDone }: { assignment: ReviewerAssignmentDetail; onDone: () => void }) {
  const { register, control, handleSubmit, getValues, formState } = useForm<FormValues>({
    resolver: zodResolver(finalSchema) as never,
    defaultValues: {
      criteria: assignment.review?.criteria ?? {},
      recommendation: assignment.review?.recommendation ?? "",
      comments: assignment.review?.comments ?? "",
    },
  });

  async function saveDraft() {
    const { criteria, recommendation, comments } = getValues();
    try {
      await api.put(`/reviewer/assignments/${assignment.id}/review`, {
        criteria,
        recommendation: recommendation || null,
        comments,
      });
      toast.success("Draft saved");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const submit = handleSubmit(async (values) => {
    try {
      await api.post(`/reviewer/assignments/${assignment.id}/review`, values);
      toast.success("Review submitted to the editors");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h3 className="mb-1 text-base font-semibold">Evaluation criteria (1–5)</h3>
        {CRITERIA.map(({ key, label }) => (
          <Controller
            key={key}
            control={control}
            name={`criteria.${key}`}
            render={({ field, fieldState }) => (
              <ScoreInput name={`criteria-${key}`} label={label} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
        ))}
      </div>
      <Field label="Your comments" htmlFor="comments" hint="Seen by the editors, who decide what to share with the writer." error={formState.errors.comments?.message}>
        <Textarea id="comments" rows={8} placeholder="Provide detailed feedback, suggestions, or corrections..." {...register("comments")} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Final recommendation</legend>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring",
                option.value === "reject"
                  ? "has-checked:border-destructive has-checked:bg-destructive/5 has-checked:text-destructive"
                  : "has-checked:border-primary has-checked:bg-primary/5 has-checked:text-primary",
              )}
            >
              <input type="radio" value={option.value} className={option.value === "reject" ? "accent-destructive" : "accent-primary"} {...register("recommendation")} />
              {option.label}
            </label>
          ))}
        </div>
        {formState.errors.recommendation?.message ? (
          <p role="alert" className="text-sm text-destructive">{formState.errors.recommendation.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Advisory. The editor makes the final decision.</p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void saveDraft()}>Save draft</Button>
        <ConfirmationDialog
          trigger={<Button type="button">Submit review</Button>}
          title="Submit this review?"
          description="You cannot change it after submitting."
          confirmLabel="Submit"
          onConfirm={() => void submit()}
        />
      </div>
    </form>
  );
}
