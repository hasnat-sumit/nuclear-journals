export const ROLES = ["reader", "writer", "reviewer", "editor"] as const;
export type Role = (typeof ROLES)[number];

// Roles that can fill in the extended profile (education, social links, photo).
export const CONTRIBUTOR_ROLES = ["writer", "reviewer", "editor"] as const satisfies readonly Role[];

export const SOCIAL_PLATFORMS = [
  "website",
  "linkedin",
  "x",
  "facebook",
  "instagram",
  "youtube",
  "github",
  "researchgate",
  "orcid",
  "google_scholar",
] as const;

export const APPLICATION_STATUSES =["pending", "approved", "rejected"] as const;
export const APPLICATION_TYPES = ["writer", "reviewer"] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export const ARTICLE_STATUSES = [
  "draft",
  "submitted",
  "editorial_screening",
  "under_review",
  "revision_requested",
  "resubmitted",
  "approved",
  "published",
  "rejected",
  "archived",
  "unpublished",
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

// CONFIDENTIALITY: this is the only place internal statuses become writer statuses.
// Every internal stage that involves reviewers must map to "pending_review".
const WRITER_STATUS_BY_INTERNAL = {
  draft: "draft",
  submitted: "pending_review",
  editorial_screening: "pending_review",
  under_review: "pending_review",
  resubmitted: "pending_review",
  revision_requested: "revision_requested",
  approved: "approved",
  published: "published",
  rejected: "rejected",
  archived: "archived",
  unpublished: "unpublished",
} as const satisfies Record<ArticleStatus, string>;

export type WriterStatus = (typeof WRITER_STATUS_BY_INTERNAL)[ArticleStatus];

export function toWriterStatus(status: ArticleStatus): WriterStatus {
  return WRITER_STATUS_BY_INTERNAL[status];
}

export const ASSIGNMENT_STATUSES = [
  "invited",
  "accepted",
  "declined",
  "in_progress",
  "completed",
  "cancelled",
  "overdue",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// Assignments that still occupy a reviewer's time and count towards their workload.
export const ACTIVE_ASSIGNMENT_STATUSES = ["invited", "accepted", "in_progress", "overdue"] as const;

export const PROFICIENCY_LEVELS = ["intermediate", "advanced", "expert"] as const;
export const RECOMMENDATIONS = ["accept", "minor_revision", "major_revision", "reject"] as const;
export const COMMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export const RATING_TARGETS = ["article", "writer", "reviewer"] as const;
export const RATING_STATUSES = ["visible", "hidden"] as const;

export const DEFAULT_REVIEW_DAYS = 14;
export const DEFAULT_MAX_PENDING_REVIEWS = 3;
