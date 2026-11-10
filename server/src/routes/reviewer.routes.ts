import { Router } from "express";
import { z } from "zod";
import { ACTIVE_ASSIGNMENT_STATUSES, PROFICIENCY_LEVELS, RECOMMENDATIONS } from "../constants.js";
import { AppError, notFoundError, objectId, parse } from "../lib/http.js";
import { currentUser, requireRole } from "../middleware/auth.js";
import { Article, type ArticleDocument } from "../models/article.model.js";
import { ReviewAssignment } from "../models/review-assignment.model.js";
import { Review } from "../models/review.model.js";
import { ReviewerProfile } from "../models/reviewer-profile.model.js";
import { markOverdueAssignments, returnToQueueIfUnassigned } from "../services/assignments.js";
import { notifyEditors } from "../services/notifications.js";
import { toReviewerArticle } from "../services/serializers.js";
import { logAction } from "../services/workflow.js";

export const reviewerRouter = Router();
reviewerRouter.use(requireRole("reviewer"));

const WORKABLE_STATUSES = ["accepted", "in_progress", "overdue"];

function toProfile(profile: {
  expertise: { category: unknown; proficiency: string }[];
  excludedTopics: unknown[];
  availability: string;
  unavailableUntil?: Date | null;
  unavailableReason?: string | null;
  maxPendingReviews: number;
  publicRecognition: boolean;
}, workload: number) {
  return {
    expertise: profile.expertise.map((item) => ({ categoryId: String(item.category), proficiency: item.proficiency })),
    excludedTopics: profile.excludedTopics.map(String),
    availability: profile.availability,
    unavailableUntil: profile.unavailableUntil ?? null,
    unavailableReason: profile.unavailableReason ?? "",
    maxPendingReviews: profile.maxPendingReviews,
    publicRecognition: profile.publicRecognition,
    workload,
  };
}

async function getProfile(userId: string) {
  // Upsert covers a reviewer whose profile is missing. Defaults keep them unavailable.
  return ReviewerProfile.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
}

function countWorkload(userId: string) {
  return ReviewAssignment.countDocuments({ reviewer: userId, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } });
}

reviewerRouter.get("/profile", async (req, res) => {
  const { id } = currentUser(req);
  const [profile, workload] = await Promise.all([getProfile(id), countWorkload(id)]);
  res.json({ data: toProfile(profile!, workload) });
});

const profileSchema = z
  .object({
    expertise: z
      .array(z.object({ categoryId: objectId, proficiency: z.enum(PROFICIENCY_LEVELS) }))
      .max(30)
      .optional(),
    excludedTopics: z.array(objectId).max(30).optional(),
    availability: z.enum(["available", "unavailable"]).optional(),
    unavailableUntil: z.coerce.date().nullable().optional(),
    unavailableReason: z.string().trim().max(500).optional(),
    maxPendingReviews: z.number().int().min(1).max(10).optional(),
    publicRecognition: z.boolean().optional(),
  })
  .refine(
    ({ expertise, excludedTopics }) => {
      if (!expertise || !excludedTopics) return true;
      return !expertise.some((item) => excludedTopics.includes(item.categoryId));
    },
    { message: "A topic cannot be both an expertise and an exclusion", path: ["excludedTopics"] },
  );

reviewerRouter.patch("/profile", async (req, res) => {
  const { id } = currentUser(req);
  const { expertise, ...rest } = parse(profileSchema, req.body);
  const update: Record<string, unknown> = { ...rest };
  if (expertise) {
    update.expertise = expertise.map(({ categoryId, proficiency }) => ({ category: categoryId, proficiency }));
  }
  if (rest.availability === "available") {
    update.unavailableUntil = null;
    update.unavailableReason = "";
  }
  const profile = await ReviewerProfile.findOneAndUpdate(
    { user: id },
    { $set: update },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  res.json({ data: toProfile(profile!, await countWorkload(id)) });
});

reviewerRouter.get("/assignments", async (req, res) => {
  await markOverdueAssignments();
  const rows = await ReviewAssignment.find({ reviewer: currentUser(req).id })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate({ path: "article", select: "title category", populate: { path: "category", select: "name slug" } })
    .lean<{
      _id: unknown;
      status: string;
      dueDate: Date;
      reviewRound: number;
      createdAt: Date;
      article: { title: string; category: { name: string; slug: string } | null } | null;
    }[]>();
  res.json({
    data: rows.map((row) => ({
      id: String(row._id),
      status: row.status,
      dueDate: row.dueDate,
      reviewRound: row.reviewRound,
      invitedAt: row.createdAt,
      articleTitle: row.article?.title ?? "Removed article",
      articleCategory: row.article?.category?.name ?? null,
    })),
  });
});

async function findOwnAssignment(id: unknown, reviewerId: string) {
  const assignment = await ReviewAssignment.findOne({ _id: parse(objectId, id), reviewer: reviewerId });
  if (!assignment) throw notFoundError("Assignment");
  return assignment;
}

reviewerRouter.get("/assignments/:id", async (req, res) => {
  const assignment = await findOwnAssignment(req.params.id, currentUser(req).id);
  const article = await Article.findById(assignment.article)
    .populate("category", "name slug")
    .lean<ArticleDocument>();
  if (!article) throw notFoundError("Article");
  const review = await Review.findOne({ assignment: assignment._id }).lean();
  res.json({
    data: {
      id: String(assignment._id),
      status: assignment.status,
      dueDate: assignment.dueDate,
      article: toReviewerArticle(article),
      review: review
        ? {
            status: review.status,
            recommendation: review.recommendation ?? null,
            criteria: review.criteria ?? {},
            comments: review.comments,
            submittedAt: review.submittedAt ?? null,
          }
        : null,
    },
  });
});

reviewerRouter.post("/assignments/:id/accept", async (req, res) => {
  const user = currentUser(req);
  const assignment = await findOwnAssignment(req.params.id, user.id);
  if (assignment.status !== "invited" && assignment.status !== "overdue") {
    throw new AppError(409, "INVALID_STATUS", "This invitation can no longer be accepted.");
  }
  if (assignment.acceptedAt) {
    throw new AppError(409, "INVALID_STATUS", "This invitation has already been accepted.");
  }
  assignment.status = "accepted";
  assignment.acceptedAt = new Date();
  await assignment.save();
  await logAction({ actor: user.id, article: assignment.article, action: "reviewer_accept", details: { assignmentId: String(assignment._id) } });
  res.json({ data: { status: assignment.status } });
});

const declineSchema = z.object({
  reason: z.string().trim().min(5, "Please give a short reason").max(1000),
  conflictOfInterest: z.boolean().optional(),
});

reviewerRouter.post("/assignments/:id/decline", async (req, res) => {
  const user = currentUser(req);
  const { reason, conflictOfInterest } = parse(declineSchema, req.body);
  const assignment = await findOwnAssignment(req.params.id, user.id);
  if (assignment.status !== "invited" && !(assignment.status === "overdue" && !assignment.acceptedAt)) {
    throw new AppError(409, "INVALID_STATUS", "This invitation can no longer be declined.");
  }

  assignment.status = "declined";
  assignment.declineReason = reason;
  await assignment.save();

  const article = await Article.findById(assignment.article).select("title author reviewRound").lean();
  if (article) {
    if (conflictOfInterest) {
      await ReviewerProfile.updateOne({ user: user.id }, { $addToSet: { conflictedAuthors: article.author } });
    }
    await returnToQueueIfUnassigned(article._id, article.reviewRound);
    // CONFIDENTIALITY: editors are told about declines. The writer is not.
    await notifyEditors(`A reviewer declined "${article.title}".`, `/dashboard/editor/articles/${String(article._id)}`);
  }
  await logAction({
    actor: user.id,
    article: assignment.article,
    action: "reviewer_decline",
    details: { assignmentId: String(assignment._id), conflictOfInterest: Boolean(conflictOfInterest) },
  });
  res.json({ data: { status: assignment.status } });
});

const score = z.number().int().min(1).max(5);
const criteriaShape = {
  technicalAccuracy: score,
  clarity: score,
  relevance: score,
  references: score,
  overall: score,
};
const draftReviewSchema = z.object({
  recommendation: z.enum(RECOMMENDATIONS).nullable().optional(),
  criteria: z.object(criteriaShape).partial().optional(),
  comments: z.string().trim().max(10000).optional(),
});
const finalReviewSchema = z.object({
  recommendation: z.enum(RECOMMENDATIONS),
  criteria: z.object(criteriaShape),
  comments: z.string().trim().min(50, "Please write at least 50 characters of feedback").max(10000),
});

async function assertCanWork(assignment: { status?: string | null; acceptedAt?: Date | null }) {
  if (!assignment.acceptedAt || !WORKABLE_STATUSES.includes(assignment.status ?? "")) {
    throw new AppError(409, "INVALID_STATUS", "Accept this assignment before writing a review.");
  }
}

reviewerRouter.put("/assignments/:id/review", async (req, res) => {
  const user = currentUser(req);
  const body = parse(draftReviewSchema, req.body);
  const assignment = await findOwnAssignment(req.params.id, user.id);
  await assertCanWork(assignment);

  await Review.findOneAndUpdate(
    { assignment: assignment._id },
    {
      $set: { ...body, recommendation: body.recommendation, status: "draft" },
      $setOnInsert: {
        article: assignment.article,
        reviewer: user.id,
        reviewRound: assignment.reviewRound,
      },
    },
    { upsert: true },
  );
  if (assignment.status === "accepted") {
    assignment.status = "in_progress";
    await assignment.save();
  }
  res.json({ data: { saved: true } });
});

reviewerRouter.post("/assignments/:id/review", async (req, res) => {
  const user = currentUser(req);
  const body = parse(finalReviewSchema, req.body);
  const assignment = await findOwnAssignment(req.params.id, user.id);
  await assertCanWork(assignment);

  const now = new Date();
  await Review.findOneAndUpdate(
    { assignment: assignment._id },
    {
      $set: { ...body, status: "submitted", submittedAt: now },
      $setOnInsert: {
        article: assignment.article,
        reviewer: user.id,
        reviewRound: assignment.reviewRound,
      },
    },
    { upsert: true },
  );
  assignment.status = "completed";
  assignment.completedAt = now;
  await assignment.save();

  await logAction({
    actor: user.id,
    article: assignment.article,
    action: "review_submitted",
    details: { assignmentId: String(assignment._id), recommendation: body.recommendation },
  });
  const article = await Article.findById(assignment.article).select("title").lean();
  await notifyEditors(`A review was submitted for "${article?.title ?? "an article"}".`, `/dashboard/editor/articles/${String(assignment.article)}`);
  res.json({ data: { status: assignment.status } });
});
