"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import type { Category, ReviewerProfile } from "@/lib/types";

type TopicChoice = "none" | "intermediate" | "advanced" | "expert" | "excluded";

function SettingsForm({ profile, categories, onSaved }: { profile: ReviewerProfile; categories: Category[]; onSaved: () => void }) {
  const [available, setAvailable] = useState(profile.availability === "available");
  const [until, setUntil] = useState(profile.unavailableUntil?.slice(0, 10) ?? "");
  const [reason, setReason] = useState(profile.unavailableReason);
  const [maxPending, setMaxPending] = useState(profile.maxPendingReviews);
  const [recognition, setRecognition] = useState(profile.publicRecognition);
  const [saving, setSaving] = useState(false);
  const [topics, setTopics] = useState<Record<string, TopicChoice>>(() => {
    const initial: Record<string, TopicChoice> = {};
    for (const item of profile.expertise) initial[item.categoryId] = item.proficiency;
    for (const id of profile.excludedTopics) initial[id] = "excluded";
    return initial;
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const entries = Object.entries(topics);
    try {
      await api.patch("/reviewer/profile", {
        availability: available ? "available" : "unavailable",
        unavailableUntil: !available && until ? new Date(until).toISOString() : null,
        unavailableReason: available ? "" : reason,
        maxPendingReviews: maxPending,
        publicRecognition: recognition,
        expertise: entries
          .filter(([, choice]) => choice !== "none" && choice !== "excluded")
          .map(([categoryId, proficiency]) => ({ categoryId, proficiency })),
        excludedTopics: entries.filter(([, choice]) => choice === "excluded").map(([id]) => id),
      });
      toast.success("Settings saved");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-8">
      <section aria-labelledby="availability-heading" className="flex flex-col gap-3">
        <h2 id="availability-heading" className="text-xl font-semibold">Availability</h2>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={available} onCheckedChange={setAvailable} />
          I am available to receive review invitations
        </label>
        {!available ? (
          <>
            <Field label="Unavailable until (optional)" htmlFor="until" hint="You become available again automatically after this date.">
              <Input id="until" type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
            </Field>
            <Field label="Reason (optional)" htmlFor="reason" hint="Seen only by the editors.">
              <Textarea id="reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </>
        ) : null}
      </section>

      <section aria-labelledby="topics-heading" className="flex flex-col gap-3">
        <h2 id="topics-heading" className="text-xl font-semibold">Topics</h2>
        <p className="text-sm text-muted-foreground">Set your level for each topic you can review, or exclude topics you don&apos;t want to review.</p>
        <div className="flex flex-col divide-y rounded-lg border bg-card">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <label htmlFor={`topic-${category.id}`} className="text-sm">{category.name}</label>
              <NativeSelect
                id={`topic-${category.id}`}
                value={topics[category.id] ?? "none"}
                onChange={(event) => setTopics({ ...topics, [category.id]: event.target.value as TopicChoice })}
              >
                <NativeSelectOption value="none">Not selected</NativeSelectOption>
                <NativeSelectOption value="intermediate">Intermediate</NativeSelectOption>
                <NativeSelectOption value="advanced">Advanced</NativeSelectOption>
                <NativeSelectOption value="expert">Expert</NativeSelectOption>
                <NativeSelectOption value="excluded">Exclude this topic</NativeSelectOption>
              </NativeSelect>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="workload-heading" className="flex flex-col gap-3">
        <h2 id="workload-heading" className="text-xl font-semibold">Workload</h2>
        <p className="text-sm text-muted-foreground">Current workload: {profile.workload}.</p>
        <Field label="Maximum pending reviews" htmlFor="max">
          <Input id="max" type="number" min={1} max={10} className="w-24" value={maxPending} onChange={(event) => setMaxPending(Number(event.target.value))} />
        </Field>
      </section>

      <section aria-labelledby="recognition-heading" className="flex flex-col gap-3">
        <h2 id="recognition-heading" className="text-xl font-semibold">Public recognition</h2>
        <label className="flex items-start gap-3 text-sm leading-6">
          <Checkbox className="mt-1" checked={recognition} onCheckedChange={setRecognition} />
          Show my name on published articles I reviewed, and on a public reviewer page.
        </label>
      </section>

      <div><Button type="submit" disabled={saving}>{saving ? "Saving" : "Save settings"}</Button></div>
    </form>
  );
}

export default function ReviewerSettingsPage() {
  const profile = useApiQuery<{ data: ReviewerProfile }>("/reviewer/profile");
  const categories = useApiQuery<{ data: Category[] }>("/categories");
  return (
    <RoleGuard role="reviewer">
      <PageTitle title="Review settings" />
      {profile.loading || categories.loading ? <LoadingSkeleton /> : null}
      {profile.error ? <ErrorState message={profile.error} onRetry={profile.reload} /> : null}
      {profile.data && categories.data ? (
        <SettingsForm profile={profile.data.data} categories={categories.data.data} onSaved={profile.reload} />
      ) : null}
    </RoleGuard>
  );
}
