import type { Types } from "mongoose";
import { ACTIVE_ASSIGNMENT_STATUSES, type ArticleStatus } from "../constants.js";
import { AppError, notFoundError } from "../lib/http.js";
import { Article, type ArticleDocument } from "../models/article.model.js";
import { ArticleFeedback } from "../models/article-feedback.model.js";
import { EditorialLog } from "../models/editorial-log.model.js";
import { ReviewAssignment } from "../models/review-assignment.model.js";
import { notify } from "./notifications.js";

type Id = Types.ObjectId | string;

export function logAction(entry: {
  actor: Id;
  article?: Id;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  details?: Record<string, unknown>;
}) {
  return EditorialLog.create(entry);
}

// `findOneAndUpdate` checks the current status and changes it in a single database
// step, so two editors acting at once cannot both succeed.
export async function transitionArticle(params: {
  articleId: string;
  from: readonly ArticleStatus[];
  to: ArticleStatus;
  actorId: string;
  action: string;
  set?: Record<string, unknown>;
  inc?: Record<string, number>;
  details?: Record<string, unknown>;
}) {
  const { articleId, from, to, actorId, action, set, inc, details } = params;
  const previous = await Article.findOneAndUpdate(
    { _id: articleId, status: { $in: from } },
    { $set: { status: to, ...set }, ...(inc ? { $inc: inc } : {}) },
    { returnDocument: "before" },
  ).lean<ArticleDocument>();

  if (!previous) {
    const exists = await Article.exists({ _id: articleId });
    if (!exists) throw notFoundError("Article");
    throw new AppError(409, "INVALID_STATUS", "This action is not available at the article's current stage.");
  }

  await logAction({
    actor: actorId,
    article: articleId,
    action,
    previousStatus: previous.status,
    newStatus: to,
    details,
  });
  return previous;
}

// A decision ends the review round, so outstanding invitations are closed.
async function cancelActiveAssignments(articleId: string) {
  const active = await ReviewAssignment.find({
    article: articleId,
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
  })
    .select("reviewer")
    .lean();
  await ReviewAssignment.updateMany(
    { _id: { $in: active.map((assignment) => assignment._id) } },
    { $set: { status: "cancelled" } },
  );
  await Promise.all(
    active.map((assignment) =>
      notify(assignment.reviewer, "A review assignment was closed because an editorial decision was made.", "/dashboard/reviewer"),
    ),
  );
}

const DECISIONS = {
  request_revision: {
    from: ["submitted", "editorial_screening", "under_review", "resubmitted", "approved"],
    to: "revision_requested",
    message: (title: string) => `Revisions were requested for "${title}".`,
  },
  approve: {
    from: ["submitted", "editorial_screening", "under_review", "resubmitted"],
    to: "approved",
    message: (title: string) => `"${title}" was approved by the editorial team.`,
  },
  reject: {
    from: ["submitted", "editorial_screening", "under_review", "resubmitted", "approved"],
    to: "rejected",
    message: (title: string) => `An editorial decision was made on "${title}".`,
  },
} as const satisfies Record<string, { from: readonly ArticleStatus[]; to: ArticleStatus; message: (title: string) => string }>;

export async function applyEditorialDecision(params: {
  articleId: string;
  decision: keyof typeof DECISIONS;
  editorId: string;
  feedback?: string;
  overrodeRecommendation?: boolean;
}) {
  const { articleId, decision, editorId, feedback } = params;
  const rule = DECISIONS[decision];
  const previous = await transitionArticle({
    articleId,
    from: rule.from,
    to: rule.to,
    actorId: editorId,
    action: decision,
    details: { feedbackReleased: Boolean(feedback) },
  });

  await cancelActiveAssignments(articleId);
  await ArticleFeedback.create({
    article: articleId,
    decision: rule.to,
    message: feedback ?? "",
    reviewRound: previous.reviewRound,
    editor: editorId,
  });
  await notify(previous.author, rule.message(previous.title), `/dashboard/writer/articles/${articleId}`);
}
