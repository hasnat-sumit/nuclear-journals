import { Router } from "express";
import { z } from "zod";
import { ACTIVE_ASSIGNMENT_STATUSES, APPLICATION_TYPES, ARTICLE_STATUSES, ASSIGNMENT_STATUSES, COMMENT_STATUSES, RATING_STATUSES, ROLES, type ArticleStatus } from "../constants.js";
import { AppError, notFoundError, objectId, paginated, paginationSchema, parse, slugSchema, toSlug } from "../lib/http.js";
import { currentUser, requireRole } from "../middleware/auth.js";
import { ArticleFeedback } from "../models/article-feedback.model.js";
import { Article } from "../models/article.model.js";
import { ArticleRevision } from "../models/article-revision.model.js";
import { Category } from "../models/category.model.js";
import { EditorialLog } from "../models/editorial-log.model.js";
import { Comment, Rating } from "../models/engagement.models.js";
import { ReviewAssignment } from "../models/review-assignment.model.js";
import { Review } from "../models/review.model.js";
import { ReviewerProfile } from "../models/reviewer-profile.model.js";
import { User } from "../models/user.model.js";
import { assignAutomatically, assignManually, evaluateReviewers, isAvailable, markOverdueAssignments } from "../services/assignments.js";
import { notify } from "../services/notifications.js";
import { applyEditorialDecision, logAction, transitionArticle } from "../services/workflow.js";

export const adminRouter = Router();
adminRouter.use(requireRole("editor"));

adminRouter.get("/overview", async (_req, res) => {
  await markOverdueAssignments();
  const countStatus = (...status: ArticleStatus[]) => Article.countDocuments({ status: { $in: status } });
  const [
    pendingWriters, pendingReviewers, newSubmissions, awaitingAssignment, underReview, revisionRequests,
    approved, published, activeAssignments, declinedAssignments, overdueReviews, pendingComments,
  ] = await Promise.all([
    User.countDocuments({ "writerApplication.status": "pending" }),
    User.countDocuments({ "reviewerApplication.status": "pending" }),
    countStatus("submitted", "resubmitted"),
    countStatus("editorial_screening"),
    countStatus("under_review"),
    countStatus("revision_requested"),
    countStatus("approved"),
    countStatus("published"),
    ReviewAssignment.countDocuments({ status: { $in: ACTIVE_ASSIGNMENT_STATUSES } }),
    ReviewAssignment.countDocuments({ status: "declined" }),
    ReviewAssignment.countDocuments({ status: "overdue" }),
    Comment.countDocuments({ status: "pending" }),
  ]);
  res.json({
    data: {
      pendingWriters, pendingReviewers, newSubmissions, awaitingAssignment, underReview, revisionRequests,
      approved, published, activeAssignments, declinedAssignments, overdueReviews, pendingComments,
    },
  });
});

adminRouter.get("/applications", async (_req, res) => {
  const users = await User.find({
    $or: [{ "writerApplication.status": "pending" }, { "reviewerApplication.status": "pending" }],
  })
    .select("name email writerApplication reviewerApplication")
    .limit(200)
    .lean();
  const data = users.flatMap((user) =>
    APPLICATION_TYPES.flatMap((type) => {
      const application = type === "writer" ? user.writerApplication : user.reviewerApplication;
      if (application?.status !== "pending") return [];
      return [{
        userId: String(user._id),
        name: user.name,
        email: user.email,
        type,
        statement: application.statement,
        credentials: application.credentials ?? "",
        submittedAt: application.submittedAt,
      }];
    }),
  );
  res.json({ data });
});

const applicationDecisionSchema = z.object({ note: z.string().trim().max(1000).optional() });

async function decideApplication(params: {
  userId: unknown;
  type: unknown;
  approve: boolean;
  note?: string;
  editorId: string;
}) {
  const userId = parse(objectId, params.userId);
  const type = parse(z.enum(APPLICATION_TYPES), params.type);
  const path = `${type}Application`;
  const set: Record<string, unknown> = {
    [`${path}.status`]: params.approve ? "approved" : "rejected",
    [`${path}.reviewedAt`]: new Date(),
    [`${path}.reviewedBy`]: params.editorId,
    [`${path}.decisionNote`]: params.note,
  };
  if (params.approve) set.role = type;

  // Only readers apply. Matching on role too means a stale application can never
  // overwrite the role of someone who has since become an editor or contributor.
  const { matchedCount } = await User.updateOne(
    { _id: userId, role: "reader", [`${path}.status`]: "pending" },
    { $set: set },
  );
  if (matchedCount === 0) throw notFoundError("Pending application");

  if (params.approve && type === "reviewer") {
    await ReviewerProfile.updateOne({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, setDefaultsOnInsert: true });
  }
  await logAction({ actor: params.editorId, action: `${params.approve ? "approve" : "reject"}_${type}_application`, details: { userId } });
  await notify(userId, `Your ${type} application was ${params.approve ? "approved" : "not approved"}.`, "/dashboard");
}

adminRouter.post("/applications/:userId/:type/approve", async (req, res) => {
  const { note } = parse(applicationDecisionSchema, req.body ?? {});
  await decideApplication({ userId: req.params.userId, type: req.params.type, approve: true, note, editorId: currentUser(req).id });
  res.json({ data: { status: "approved" } });
});

adminRouter.post("/applications/:userId/:type/reject", async (req, res) => {
  const { note } = parse(applicationDecisionSchema, req.body ?? {});
  await decideApplication({ userId: req.params.userId, type: req.params.type, approve: false, note, editorId: currentUser(req).id });
  res.json({ data: { status: "rejected" } });
});

adminRouter.get("/users", async (req, res) => {
  const { page, limit, role } = parse(paginationSchema.extend({ role: z.enum(ROLES).optional() }), req.query);
  const filter = role ? { role } : {};
  const [rows, total] = await Promise.all([
    User.find(filter).select("name email role isActive createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const data = rows.map((user) => ({
    id: String(user._id), name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt,
  }));
  res.json(paginated(data, total, page, limit));
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
  const editor = currentUser(req);
  if (id === editor.id) throw new AppError(409, "FORBIDDEN", "You cannot change your own account status.");
  const { matchedCount } = await User.updateOne({ _id: id }, { $set: { isActive } });
  if (matchedCount === 0) throw notFoundError("User");
  await logAction({ actor: editor.id, action: isActive ? "activate_user" : "deactivate_user", details: { userId: id } });
  res.json({ data: { isActive } });
});

const articleListSchema = paginationSchema.extend({
  status: z.enum(ARTICLE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

adminRouter.get("/articles", async (req, res) => {
  const { page, limit, status } = parse(articleListSchema, req.query);
  const filter = status ? { status } : {};
  const [rows, total] = await Promise.all([
    Article.find(filter)
      .select("title slug status featured reviewRound submittedAt publishedAt author category updatedAt")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", "name email")
      .populate("category", "name slug")
      .lean(),
    Article.countDocuments(filter),
  ]);
  res.json(paginated(rows, total, page, limit));
});

adminRouter.get("/articles/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  await markOverdueAssignments();
  const [article, assignments, reviews, feedback, logs, revisions] = await Promise.all([
    Article.findById(id).populate("author", "name email").populate("category", "name slug").lean(),
    ReviewAssignment.find({ article: id }).sort({ createdAt: -1 }).populate("reviewer", "name email").populate("assignedBy", "name").lean(),
    Review.find({ article: id, status: "submitted" }).sort({ submittedAt: -1 }).populate("reviewer", "name email").lean(),
    ArticleFeedback.find({ article: id }).sort({ createdAt: -1 }).populate("editor", "name").lean(),
    EditorialLog.find({ article: id }).sort({ createdAt: -1 }).limit(100).populate("actor", "name").lean(),
    ArticleRevision.find({ article: id }).select("version title changeSummary createdAt").sort({ version: -1 }).lean(),
  ]);
  if (!article) throw notFoundError("Article");
  res.json({ data: { article, assignments, reviews, feedback, logs, revisions } });
});

adminRouter.post("/articles/:id/start-screening", async (req, res) => {
  await transitionArticle({
    articleId: parse(objectId, req.params.id),
    from: ["submitted", "resubmitted"],
    to: "editorial_screening",
    actorId: currentUser(req).id,
    action: "start_screening",
  });
  res.json({ data: { status: "editorial_screening" } });
});

adminRouter.get("/articles/:id/eligible-reviewers", async (req, res) => {
  res.json({ data: await evaluateReviewers(parse(objectId, req.params.id)) });
});

const futureDate = z.coerce.date().refine((date) => date > new Date(), "must be in the future");
const assignSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("automatic"), count: z.number().int().min(1).max(5).default(1), dueDate: futureDate.optional() }),
  z.object({
    mode: z.literal("manual"),
    reviewerIds: z.array(objectId).min(1).max(5),
    overrideReason: z.string().trim().min(5).max(1000).optional(),
    dueDate: futureDate.optional(),
  }),
]);

adminRouter.post("/articles/:id/assign-reviewers", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const editor = currentUser(req);
  const body = parse(assignSchema, req.body);
  const assignments =
    body.mode === "automatic"
      ? await assignAutomatically(id, editor.id, body.count, body.dueDate)
      : await assignManually(id, editor.id, body.reviewerIds, body.overrideReason, body.dueDate);
  res.status(assignments.length > 0 ? 201 : 200).json({
    data: { assigned: assignments.map((item) => String(item._id)) },
    message: assignments.length > 0 ? undefined : "No eligible reviewer found. The article stays in your queue.",
  });
});

adminRouter.post("/assignments/:id/cancel", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const assignment = await ReviewAssignment.findOneAndUpdate(
    { _id: id, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } },
    { $set: { status: "cancelled" } },
  ).lean();
  if (!assignment) throw notFoundError("Active assignment");
  await logAction({ actor: currentUser(req).id, article: assignment.article, action: "cancel_assignment", details: { assignmentId: id } });
  await notify(assignment.reviewer, "A review invitation was cancelled by the editorial team.", "/dashboard/reviewer");
  res.json({ data: { status: "cancelled" } });
});

const decisionSchema = z.object({ feedback: z.string().trim().max(10000).optional() });
const requiredFeedbackSchema = z.object({ feedback: z.string().trim().min(10, "Please include feedback for the writer").max(10000) });

adminRouter.post("/articles/:id/approve", async (req, res) => {
  const { feedback } = parse(decisionSchema, req.body ?? {});
  await applyEditorialDecision({ articleId: parse(objectId, req.params.id), decision: "approve", editorId: currentUser(req).id, feedback });
  res.json({ data: { status: "approved" } });
});

adminRouter.post("/articles/:id/request-revision", async (req, res) => {
  const { feedback } = parse(requiredFeedbackSchema, req.body);
  await applyEditorialDecision({ articleId: parse(objectId, req.params.id), decision: "request_revision", editorId: currentUser(req).id, feedback });
  res.json({ data: { status: "revision_requested" } });
});

adminRouter.post("/articles/:id/reject", async (req, res) => {
  const { feedback } = parse(requiredFeedbackSchema, req.body);
  await applyEditorialDecision({ articleId: parse(objectId, req.params.id), decision: "reject", editorId: currentUser(req).id, feedback });
  res.json({ data: { status: "rejected" } });
});

adminRouter.post("/articles/:id/publish", async (req, res) => {
  const articleId = parse(objectId, req.params.id);
  const existing = await Article.findById(articleId).select("publishedAt").lean();
  const previous = await transitionArticle({
    articleId,
    from: ["approved", "unpublished"],
    to: "published",
    actorId: currentUser(req).id,
    action: "publish",
    // Republishing keeps the original publication date.
    set: { publishedAt: existing?.publishedAt ?? new Date() },
  });
  await notify(previous.author, `"${previous.title}" has been published.`, `/articles/${previous.slug}`);
  res.json({ data: { status: "published" } });
});

adminRouter.post("/articles/:id/unpublish", async (req, res) => {
  const previous = await transitionArticle({
    articleId: parse(objectId, req.params.id),
    from: ["published"],
    to: "unpublished",
    actorId: currentUser(req).id,
    action: "unpublish",
    set: { featured: false },
  });
  await notify(previous.author, `"${previous.title}" was unpublished by the editorial team.`, "/dashboard/writer");
  res.json({ data: { status: "unpublished" } });
});

adminRouter.post("/articles/:id/archive", async (req, res) => {
  const previous = await transitionArticle({
    articleId: parse(objectId, req.params.id),
    from: ["published", "unpublished", "approved", "rejected"],
    to: "archived",
    actorId: currentUser(req).id,
    action: "archive",
    set: { featured: false },
  });
  await notify(previous.author, `"${previous.title}" was archived by the editorial team.`, "/dashboard/writer");
  res.json({ data: { status: "archived" } });
});

adminRouter.post("/articles/:id/feature", async (req, res) => {
  const articleId = parse(objectId, req.params.id);
  const { featured } = parse(z.object({ featured: z.boolean() }), req.body);
  const { matchedCount } = await Article.updateOne({ _id: articleId, status: "published" }, { $set: { featured } });
  if (matchedCount === 0) throw notFoundError("Published article");
  await logAction({ actor: currentUser(req).id, article: articleId, action: featured ? "feature" : "unfeature" });
  res.json({ data: { featured } });
});

adminRouter.get("/reviewers", async (_req, res) => {
  const [profiles, workloads] = await Promise.all([
    ReviewerProfile.find()
      .populate("user", "name email role isActive")
      .populate("expertise.category", "name")
      .lean<{
        user: { _id: unknown; name: string; email: string; role: string; isActive: boolean } | null;
        expertise: { category: { name: string } | null; proficiency: string }[];
        availability: string;
        unavailableUntil?: Date;
        unavailableReason?: string;
        maxPendingReviews: number;
      }[]>(),
    ReviewAssignment.aggregate<{ _id: unknown; count: number }>([
      { $match: { status: { $in: ACTIVE_ASSIGNMENT_STATUSES } } },
      { $group: { _id: "$reviewer", count: { $sum: 1 } } },
    ]),
  ]);
  const workloadById = new Map(workloads.map((row) => [String(row._id), row.count]));
  res.json({
    data: profiles
      .filter((profile) => profile.user?.role === "reviewer")
      .map((profile) => ({
        id: String(profile.user!._id),
        name: profile.user!.name,
        email: profile.user!.email,
        available: isAvailable(profile),
        unavailableUntil: profile.unavailableUntil ?? null,
        unavailableReason: profile.unavailableReason ?? "",
        expertise: profile.expertise.map((item) => ({ name: item.category?.name ?? "Unknown", proficiency: item.proficiency })),
        workload: workloadById.get(String(profile.user!._id)) ?? 0,
        maxPendingReviews: profile.maxPendingReviews,
      })),
  });
});

adminRouter.get("/assignments", async (req, res) => {
  await markOverdueAssignments();
  const { page, limit, status } = parse(paginationSchema.extend({ status: z.enum(ASSIGNMENT_STATUSES).optional() }), req.query);
  const filter = status ? { status } : {};
  const [rows, total] = await Promise.all([
    ReviewAssignment.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("article", "title")
      .populate("reviewer", "name email")
      .lean(),
    ReviewAssignment.countDocuments(filter),
  ]);
  res.json(paginated(rows, total, page, limit));
});

adminRouter.get("/categories", async (_req, res) => {
  res.json({ data: await Category.find().sort({ displayOrder: 1, name: 1 }).lean() });
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
});

adminRouter.post("/categories", async (req, res) => {
  const body = parse(categorySchema, req.body);
  const category = await Category.create({ ...body, slug: body.slug ?? toSlug(body.name) });
  await logAction({ actor: currentUser(req).id, action: "create_category", details: { categoryId: String(category._id) } });
  res.status(201).json({ data: category });
});

adminRouter.patch("/categories/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const category = await Category.findByIdAndUpdate(id, { $set: parse(categorySchema.partial(), req.body) }, { returnDocument: "after", runValidators: true }).lean();
  if (!category) throw notFoundError("Category");
  await logAction({ actor: currentUser(req).id, action: "update_category", details: { categoryId: id } });
  res.json({ data: category });
});

adminRouter.get("/comments", async (req, res) => {
  const { page, limit, status } = parse(paginationSchema.extend({ status: z.enum(COMMENT_STATUSES).default("pending") }), req.query);
  const filter = { status };
  const [rows, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "name email").populate("article", "title slug").lean(),
    Comment.countDocuments(filter),
  ]);
  res.json(paginated(rows, total, page, limit));
});

adminRouter.patch("/comments/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { status } = parse(z.object({ status: z.enum(COMMENT_STATUSES) }), req.body);
  const comment = await Comment.findByIdAndUpdate(id, { $set: { status } }).lean();
  if (!comment) throw notFoundError("Comment");
  await logAction({ actor: currentUser(req).id, article: comment.article, action: `comment_${status}`, details: { commentId: id } });
  res.json({ data: { status } });
});

adminRouter.get("/ratings", async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const [rows, total] = await Promise.all([
    Rating.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "name email").lean(),
    Rating.countDocuments(),
  ]);
  res.json(paginated(rows, total, page, limit));
});

adminRouter.patch("/ratings/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { status } = parse(z.object({ status: z.enum(RATING_STATUSES) }), req.body);
  const rating = await Rating.findByIdAndUpdate(id, { $set: { status } }).lean();
  if (!rating) throw notFoundError("Rating");
  await logAction({ actor: currentUser(req).id, action: `rating_${status}`, details: { ratingId: id } });
  res.json({ data: { status } });
});

adminRouter.get("/logs", async (req, res) => {
  const { page, limit } = parse(paginationSchema.extend({ limit: z.coerce.number().int().min(1).max(100).default(50) }), req.query);
  const [rows, total] = await Promise.all([
    EditorialLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("actor", "name").populate("article", "title").lean(),
    EditorialLog.countDocuments(),
  ]);
  res.json(paginated(rows, total, page, limit));
});
