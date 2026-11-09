export type Role = "reader" | "writer" | "reviewer" | "editor";

export type WriterStatus =
  | "draft"
  | "pending_review"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "published"
  | "archived"
  | "unpublished";

export type ArticleStatus =
  | "draft"
  | "submitted"
  | "editorial_screening"
  | "under_review"
  | "revision_requested"
  | "resubmitted"
  | "approved"
  | "published"
  | "rejected"
  | "archived"
  | "unpublished";

export type AssignmentStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface Category extends CategoryRef {
  description: string;
  image: string | null;
  articleCount: number;
}

export interface AuthorRef {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: { url: string; alt: string } | null;
  category: CategoryRef | null;
  author: AuthorRef | null;
  tags: string[];
  readingTime: number;
  featured: boolean;
  publishedAt: string | null;
}

export interface Reference {
  citation: string;
  url: string | null;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface ArticleDetail extends ArticleSummary {
  contentHtml: string;
  references: Reference[];
  viewCount: number;
  related: ArticleSummary[];
  reviewers: { id: string; name: string }[];
  rating: RatingSummary;
}

export interface PublicProfile {
  id: string;
  name: string;
  image: string | null;
  bio: string;
  expertise: string[];
  rating: RatingSummary;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface ApplicationView {
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  decisionNote: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  bio: string;
  expertise: string[];
  writerApplication: ApplicationView | null;
  reviewerApplication: ApplicationView | null;
}

export interface WriterArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentJson: Record<string, unknown> | null;
  contentHtml: string;
  coverImage: { url: string; publicId: string; alt: string } | null;
  category: CategoryRef | null;
  tags: string[];
  references: Reference[];
  declarations: { author: boolean; originality: boolean; confidentiality: boolean };
  status: WriterStatus;
  readingTime: number;
  viewCount: number;
  version: number;
  createdAt: string | null;
  submittedAt: string | null;
  lastEditedAt: string | null;
  publishedAt: string | null;
}

export interface Feedback {
  id: string;
  decision: "revision_requested" | "approved" | "rejected";
  message: string;
  createdAt: string;
}

export interface Revision {
  id: string;
  version: number;
  title: string;
  changeSummary: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ReviewerProfile {
  expertise: { categoryId: string; proficiency: "intermediate" | "advanced" | "expert" }[];
  excludedTopics: string[];
  availability: "available" | "unavailable";
  unavailableUntil: string | null;
  unavailableReason: string;
  maxPendingReviews: number;
  publicRecognition: boolean;
  workload: number;
}

export interface ReviewerAssignmentSummary {
  id: string;
  status: AssignmentStatus;
  dueDate: string;
  reviewRound: number;
  invitedAt: string;
  articleTitle: string;
  articleCategory: string | null;
}

export interface ReviewCriteria {
  technicalAccuracy?: number;
  clarity?: number;
  relevance?: number;
  references?: number;
  overall?: number;
}

export type Recommendation = "accept" | "minor_revision" | "major_revision" | "reject";

export interface ReviewerAssignmentDetail {
  id: string;
  status: AssignmentStatus;
  dueDate: string;
  article: {
    id: string;
    title: string;
    excerpt: string;
    contentHtml: string;
    category: CategoryRef | null;
    tags: string[];
    references: Reference[];
    readingTime: number;
    reviewRound: number;
  };
  review: {
    status: "draft" | "submitted";
    recommendation: Recommendation | null;
    criteria: ReviewCriteria;
    comments: string;
    submittedAt: string | null;
  } | null;
}

export interface EditorOverview {
  pendingWriters: number;
  pendingReviewers: number;
  newSubmissions: number;
  awaitingAssignment: number;
  underReview: number;
  revisionRequests: number;
  approved: number;
  published: number;
  activeAssignments: number;
  declinedAssignments: number;
  overdueReviews: number;
  pendingComments: number;
}

export interface EditorArticleRow {
  _id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  featured: boolean;
  reviewRound: number;
  submittedAt?: string;
  publishedAt?: string;
  updatedAt: string;
  author: { name: string; email: string } | null;
  category: { name: string; slug: string } | null;
}

export interface ReviewerEvaluation {
  reviewerId: string;
  name: string;
  email: string;
  proficiency: string | null;
  workload: number;
  maxPendingReviews: number;
  eligible: boolean;
  reasons: string[];
  blocked: boolean;
}

export interface EditorArticleDetail {
  article: EditorArticleRow & {
    excerpt: string;
    content: { html: string };
    tags: string[];
    references: Reference[];
    readingTime: number;
  };
  assignments: {
    _id: string;
    status: AssignmentStatus;
    assignmentType: "automatic" | "manual";
    reviewRound: number;
    dueDate: string;
    declineReason?: string;
    overrideReason?: string;
    reviewer: { name: string; email: string } | null;
    assignedBy: { name: string } | null;
  }[];
  reviews: {
    _id: string;
    reviewRound: number;
    recommendation: Recommendation;
    criteria: ReviewCriteria;
    comments: string;
    submittedAt: string;
    reviewer: { name: string; email: string } | null;
  }[];
  feedback: { _id: string; decision: string; message: string; createdAt: string; editor: { name: string } | null }[];
  logs: {
    _id: string;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    createdAt: string;
    actor: { name: string } | null;
  }[];
  revisions: { _id: string; version: number; title: string; changeSummary: string; createdAt: string }[];
}
