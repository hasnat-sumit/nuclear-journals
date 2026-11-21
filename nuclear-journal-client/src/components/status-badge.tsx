import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  published: "bg-brand-teal text-white",
  approved: "bg-brand-teal/15 text-brand-teal-strong",
  completed: "bg-brand-teal/15 text-brand-teal-strong",
  accepted: "bg-brand-teal/15 text-brand-teal-strong",
  in_progress: "bg-primary/10 text-primary",
  under_review: "bg-primary/10 text-primary",
  pending_review: "bg-primary/10 text-primary",
  submitted: "bg-primary/10 text-primary",
  resubmitted: "bg-primary/10 text-primary",
  editorial_screening: "bg-primary/10 text-primary",
  invited: "bg-primary/10 text-primary",
  pending: "bg-primary/10 text-primary",
  revision_requested: "bg-amber-100 text-amber-900",
  overdue: "bg-amber-100 text-amber-900",
  rejected: "bg-destructive/10 text-destructive",
  declined: "bg-destructive/10 text-destructive",
};

// The label always carries the meaning, so colour is never the only signal.
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn(TONES[status])}>
      {humanize(status)}
    </Badge>
  );
}
