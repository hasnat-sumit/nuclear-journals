"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageTitle, useMe } from "@/components/dashboard/dashboard-shell";
import { Field } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { ApplicationView } from "@/lib/types";

const schema = z.object({
  statement: z.string().trim().min(50, "Please write at least 50 characters").max(2000),
  credentials: z.string().trim().max(1000).optional(),
});

function ApplicationCard({
  type,
  application,
  blocked,
  description,
}: {
  type: "writer" | "reviewer";
  application: ApplicationView | null;
  blocked: boolean;
  description: string;
}) {
  const { reload } = useMe();
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post(`/me/applications/${type}`, values);
      toast.success("Application sent to the editors.");
      reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const canApply = !blocked && application?.status !== "pending";

  return (
    <section aria-labelledby={`${type}-heading`} className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${type}-heading`} className="text-xl font-semibold capitalize">Become a {type}</h2>
        {application ? <StatusBadge status={application.status} /> : null}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      {application ? <p className="text-sm text-muted-foreground">Submitted {formatDate(application.submittedAt)}.</p> : null}
      {application?.decisionNote ? <p className="text-sm">Editor&apos;s note: {application.decisionNote}</p> : null}
      {canApply ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <Field label="Why do you want to join?" htmlFor={`${type}-statement`} error={formState.errors.statement?.message}>
            <Textarea id={`${type}-statement`} rows={4} {...register("statement")} />
          </Field>
          <Field label="Relevant qualifications or experience" htmlFor={`${type}-credentials`}>
            <Input id={`${type}-credentials`} {...register("credentials")} />
          </Field>
          <div><Button type="submit" disabled={formState.isSubmitting}>Submit application</Button></div>
        </form>
      ) : null}
    </section>
  );
}

const HOME_BY_ROLE = {
  writer: "/dashboard/writer",
  reviewer: "/dashboard/reviewer",
  editor: "/dashboard/editor",
} as const;

export default function DashboardHome() {
  const { me } = useMe();
  const router = useRouter();
  const home = me.role === "reader" ? null : HOME_BY_ROLE[me.role];

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  if (home) return null;

  const hasPending = me.writerApplication?.status === "pending" || me.reviewerApplication?.status === "pending";

  return (
    <>
      <PageTitle title={`Welcome, ${me.name}`} description="Save articles to read later, or apply to contribute." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ApplicationCard
          type="writer"
          application={me.writerApplication}
          blocked={hasPending}
          description="Write technical and educational articles. An editor reviews each application."
        />
        <ApplicationCard
          type="reviewer"
          application={me.reviewerApplication}
          blocked={hasPending}
          description="Evaluate submissions in your area of expertise. An editor reviews each application."
        />
      </div>
    </>
  );
}
