import type { Types } from "mongoose";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  DEFAULT_REVIEW_DAYS,
  PROFICIENCY_LEVELS,
} from "../constants.js";
import { AppError, notFoundError } from "../lib/http.js";
import { Article, type ArticleDocument } from "../models/article.model.js";
import { ReviewAssignment } from "../models/review-assignment.model.js";
import { ReviewerProfile } from "../models/reviewer-profile.model.js";
import { notify, notifyEditors } from "./notifications.js";
import { logAction } from "./workflow.js";

const ASSIGNABLE_STATUSES = ["submitted", "editorial_screening", "resubmitted", "under_review"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewerEvaluation {
  reviewerId: string;
  name: string;
  email: string;
  proficiency: string | null;
  workload: number;
  maxPendingReviews: number;
  totalAssignments: number;
  eligible: boolean;
  // Why this reviewer is not eligible. Empty when eligible.
  reasons: string[];
  // Reasons no override can bypass.
  blocked: boolean;
}

interface ProfileWithUser {
  user: { _id: Types.ObjectId; name: string; email: string; role: string; isActive: boolean } | null;
  expertise: { category: Types.ObjectId; proficiency: string }[];
  excludedTopics: Types.ObjectId[];
  conflictedAuthors: Types.ObjectId[];
  availability: string;
  unavailableUntil?: Date;
  maxPendingReviews: number;
  isActive: boolean;
}

// Reviewers default to unavailable and stay that way until they choose otherwise.
// A date only re-opens availability when the reviewer set one themselves.
export function isAvailable(profile: { availability: string; unavailableUntil?: Date | null }, now = new Date()) {
  if (profile.availability === "available") return true;
  return Boolean(profile.unavailableUntil && profile.unavailableUntil <= now);
}

export async function markOverdueAssignments() {
  await ReviewAssignment.updateMany(
    { status: { $in: ["invited", "accepted", "in_progress"] }, dueDate: { $lt: new Date() } },
    { $set: { status: "overdue" } },
  );
}

async function loadArticle(articleId: string) {
  const article = await Article.findById(articleId).lean<ArticleDocument>();
  if (!article) throw notFoundError("Article");
  return article;
}

async function countByReviewer(match: Record<string, unknown>) {
  const rows = await ReviewAssignment.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: match },
    { $group: { _id: "$reviewer", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function evaluateReviewers(articleId: string): Promise<ReviewerEvaluation[]> {
  const article = await loadArticle(articleId);
  const categoryId = article.category ? String(article.category) : null;

  const [profiles, workloads, totals, thisArticle] = await Promise.all([
    ReviewerProfile.find().populate("user", "name email role isActive").lean<ProfileWithUser[]>(),
    countByReviewer({ status: { $in: ACTIVE_ASSIGNMENT_STATUSES } }),
    countByReviewer({}),
    ReviewAssignment.find({ article: articleId }).select("reviewer status reviewRound").lean(),
  ]);

  return profiles
    .filter((profile) => profile.user?.role === "reviewer")
    .map((profile) => {
      const user = profile.user!;
      const reviewerId = String(user._id);
      const expertise = profile.expertise.find((item) => String(item.category) === categoryId);
      const workload = workloads.get(reviewerId) ?? 0;
      const history = thisArticle.filter((item) => String(item.reviewer) === reviewerId);
      const isAuthor = reviewerId === String(article.author);
      const hasActive = history.some((item) =>
        (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(item.status ?? ""),
      );

      const reasons: string[] = [];
      if (!profile.isActive || !user.isActive) reasons.push("Reviewer account is inactive");
      if (!isAvailable(profile)) reasons.push("Reviewer is unavailable");
      if (!expertise) reasons.push("No expertise in this article's category");
      if (profile.excludedTopics.some((topic) => String(topic) === categoryId)) {
        reasons.push("Reviewer excluded this topic");
      }
      if (workload >= profile.maxPendingReviews) reasons.push("Reviewer is at workload capacity");
      if (isAuthor || profile.conflictedAuthors.some((author) => String(author) === String(article.author))) {
        reasons.push("Conflict of interest with the author");
      }
      if (history.some((item) => item.status === "declined" && item.reviewRound === article.reviewRound)) {
        reasons.push("Reviewer already declined this article");
      }
      if (hasActive) reasons.push("Reviewer already has an active assignment on this article");

      return {
        reviewerId,
        name: user.name,
        email: user.email,
        proficiency: expertise?.proficiency ?? null,
        workload,
        maxPendingReviews: profile.maxPendingReviews,
        totalAssignments: totals.get(reviewerId) ?? 0,
        eligible: reasons.length === 0,
        reasons,
        blocked: isAuthor || hasActive,
      };
    });
}

// Deterministic: the same data always produces the same order. The final tie-break
// on id means the result never depends on database ordering.
export function rankReviewers(reviewers: ReviewerEvaluation[]) {
  const proficiencyRank = (value: string | null) =>
    value ? PROFICIENCY_LEVELS.indexOf(value as (typeof PROFICIENCY_LEVELS)[number]) : -1;

  return [...reviewers].sort(
    (a, b) =>
      proficiencyRank(b.proficiency) - proficiencyRank(a.proficiency) ||
      a.workload - b.workload ||
      a.totalAssignments - b.totalAssignments ||
      a.reviewerId.localeCompare(b.reviewerId),
  );
}

async function createAssignment(params: {
  article: ArticleDocument;
  reviewerId: string;
  editorId: string;
  type: "automatic" | "manual";
  dueDate: Date;
  overrideReason?: string;
  warnings?: string[];
}) {
  const { article, reviewerId, editorId, type, dueDate, overrideReason, warnings } = params;
  const assignment = await ReviewAssignment.create({
    article: article._id,
    reviewer: reviewerId,
    assignedBy: editorId,
    assignmentType: type,
    reviewRound: article.reviewRound,
    dueDate,
    overrideReason,
  });

  await logAction({
    actor: editorId,
    article: article._id,
    action: overrideReason ? "assign_reviewer_override" : "assign_reviewer",
    previousStatus: article.status,
    newStatus: "under_review",
    details: { reviewerId, assignmentType: type, overrideReason, overriddenRules: warnings },
  });
  await notify(reviewerId, `You have been invited to review "${article.title}".`, "/dashboard/reviewer");
  return assignment;
}

function assertAssignable(article: ArticleDocument) {
  if (!(ASSIGNABLE_STATUSES as readonly string[]).includes(article.status)) {
    throw new AppError(409, "INVALID_STATUS", "Reviewers cannot be assigned at this article's current stage.");
  }
  if (!article.category) {
    throw new AppError(409, "INVALID_STATUS", "The article has no category.");
  }
}

async function moveToUnderReview(articleId: string) {
  await Article.updateOne(
    { _id: articleId, status: { $in: ["submitted", "editorial_screening", "resubmitted"] } },
    { $set: { status: "under_review" } },
  );
}

function resolveDueDate(dueDate?: Date) {
  return dueDate ?? new Date(Date.now() + DEFAULT_REVIEW_DAYS * DAY_MS);
}

export async function assignAutomatically(articleId: string, editorId: string, count: number, dueDate?: Date) {
  const article = await loadArticle(articleId);
  assertAssignable(article);

  const evaluations = await evaluateReviewers(articleId);
  const selected = rankReviewers(evaluations.filter((item) => item.eligible)).slice(0, count);

  if (selected.length === 0) {
    // Never force an assignment. The article stays in the editor's queue.
    await logAction({ actor: editorId, article: article._id, action: "auto_assign_no_eligible_reviewer" });
    await notifyEditors(`No eligible reviewer was found for "${article.title}".`, `/dashboard/editor/articles/${articleId}`);
    return [];
  }

  const assignments = [];
  for (const reviewer of selected) {
    assignments.push(
      await createAssignment({
        article,
        reviewerId: reviewer.reviewerId,
        editorId,
        type: "automatic",
        dueDate: resolveDueDate(dueDate),
      }),
    );
  }
  await moveToUnderReview(articleId);
  return assignments;
}

export async function assignManually(
  articleId: string,
  editorId: string,
  reviewerIds: string[],
  overrideReason?: string,
  dueDate?: Date,
) {
  const article = await loadArticle(articleId);
  assertAssignable(article);

  const evaluations = new Map((await evaluateReviewers(articleId)).map((item) => [item.reviewerId, item]));

  // Validate everything first, so one bad reviewer doesn't leave a partial assignment.
  const needsOverride = [];
  for (const reviewerId of reviewerIds) {
    const evaluation = evaluations.get(reviewerId);
    if (!evaluation) throw notFoundError("Reviewer");
    if (evaluation.blocked) {
      throw new AppError(409, "ASSIGNMENT_BLOCKED", `${evaluation.name} cannot be assigned: ${evaluation.reasons.join("; ")}.`);
    }
    if (!evaluation.eligible) needsOverride.push(evaluation);
  }
  if (needsOverride.length > 0 && !overrideReason) {
    throw new AppError(
      422,
      "OVERRIDE_REQUIRED",
      "Some reviewers do not meet the assignment rules. Record a reason to override.",
      needsOverride.map(({ reviewerId, name, reasons }) => ({ reviewerId, name, reasons })),
    );
  }

  const assignments = [];
  for (const reviewerId of reviewerIds) {
    const evaluation = evaluations.get(reviewerId)!;
    assignments.push(
      await createAssignment({
        article,
        reviewerId,
        editorId,
        type: "manual",
        dueDate: resolveDueDate(dueDate),
        overrideReason: evaluation.eligible ? undefined : overrideReason,
        warnings: evaluation.eligible ? undefined : evaluation.reasons,
      }),
    );
  }
  await moveToUnderReview(articleId);
  return assignments;
}

// When a reviewer declines and nobody else is working on the article, it returns to
// the editor's assignment queue. The writer-visible status does not change.
export async function returnToQueueIfUnassigned(articleId: Types.ObjectId | string, reviewRound: number) {
  const stillCovered = await ReviewAssignment.exists({
    article: articleId,
    reviewRound,
    status: { $in: [...ACTIVE_ASSIGNMENT_STATUSES, "completed"] },
  });
  if (stillCovered) return;
  await Article.updateOne(
    { _id: articleId, status: "under_review" },
    { $set: { status: "editorial_screening" } },
  );
}
