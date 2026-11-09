"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/feedback-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate } from "@/lib/format";

interface Application {
  userId: string;
  name: string;
  email: string;
  type: "writer" | "reviewer";
  statement: string;
  credentials: string;
  submittedAt: string;
}

function ApplicationRow({ application, onDone }: { application: Application; onDone: () => void }) {
  const [note, setNote] = useState("");

  async function decide(decision: "approve" | "reject") {
    try {
      await api.post(`/admin/applications/${application.userId}/${application.type}/${decision}`, { note: note || undefined });
      toast.success(decision === "approve" ? "Application approved" : "Application rejected");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div>
        <p className="font-medium">{application.name} <span className="font-normal text-muted-foreground">({application.email})</span></p>
        <p className="text-sm text-muted-foreground capitalize">{application.type} application · {formatDate(application.submittedAt)}</p>
      </div>
      <p className="leading-7 whitespace-pre-wrap">{application.statement}</p>
      {application.credentials ? <p className="text-sm text-muted-foreground">Qualifications: {application.credentials}</p> : null}
      <Input aria-label={`Note to ${application.name} (optional)`} placeholder="Note to the applicant (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex gap-2">
        <Button onClick={() => void decide("approve")}>Approve</Button>
        <Button variant="destructive" onClick={() => void decide("reject")}>Reject</Button>
      </div>
    </li>
  );
}

export default function ApplicationsPage() {
  const { data, error, loading, reload } = useApiQuery<{ data: Application[] }>("/admin/applications");
  return (
    <RoleGuard role="editor">
      <PageTitle title="Applications" />
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data?.data.length === 0 ? <EmptyState title="No applications waiting" /> : null}
      <ul className="flex flex-col gap-4">
        {data?.data.map((application) => (
          <ApplicationRow key={`${application.userId}-${application.type}`} application={application} onDone={reload} />
        ))}
      </ul>
    </RoleGuard>
  );
}
