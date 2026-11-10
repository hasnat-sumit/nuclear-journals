import type { Request } from "express";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { Types } from "mongoose";
import { z } from "zod";
import { RATING_TARGETS } from "../constants.js";
import { AppError, notFoundError, objectId, paginated, paginationSchema, parse } from "../lib/http.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { Article, type ArticleDocument } from "../models/article.model.js";
import { Category } from "../models/category.model.js";
import { Comment, Rating } from "../models/engagement.models.js";
import { ReviewAssignment } from "../models/review-assignment.model.js";
import { ReviewerProfile } from "../models/reviewer-profile.model.js";
import { User } from "../models/user.model.js";
import { toProfileExtras, toPublicArticle, toPublicArticleSummary } from "../services/serializers.js";

export const publicRouter = Router();

const PUBLIC_POPULATE = [
  { path: "category", select: "name slug" },
  { path: "author", select: "name image bio" },
];

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
function writeLimiter(limit: number) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.currentUser?.id ?? "anonymous",
    message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
  });
}

const listSchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.string().max(120).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
  author: objectId.optional(),
  featured: z.enum(["true"]).optional(),
  sort: z.enum(["latest", "relevant"]).default("latest"),
});

async function listPublished(query: unknown) {
  const { page, limit, q, category, tag, author, featured, sort } = parse(listSchema, query);
  const filter: Record<string, unknown> = { status: "published" };
  if (q) filter.$text = { $search: q };
  if (tag) filter.tags = tag;
  if (author) filter.author = new Types.ObjectId(author);
  if (featured) filter.featured = true;
  if (category) {
    const found = await Category.findOne({ slug: category }).select("_id").lean();
    if (!found) return paginated([], 0, page, limit);
    filter.category = found._id;
  }

  const byRelevance = q && sort === "relevant";
  const find = Article.find(filter, byRelevance ? { score: { $meta: "textScore" } } : {}).select(
    "-content -plainText",
  );
  const [rows, total] = await Promise.all([
    find
      .sort(byRelevance ? { score: { $meta: "textScore" } } : { publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(PUBLIC_POPULATE)
      .lean<ArticleDocument[]>(),
    Article.countDocuments(filter),
  ]);
  return paginated(rows.map(toPublicArticleSummary), total, page, limit);
}

async function ratingSummary(targetType: string, targetId: Types.ObjectId) {
  const [row] = await Rating.aggregate<{ average: number; count: number }>([
    { $match: { targetType, targetId, status: "visible" } },
    { $group: { _id: null, average: { $avg: "$score" }, count: { $sum: 1 } } },
  ]);
  return { average: row ? Math.round(row.average * 10) / 10 : null, count: row?.count ?? 0 };
}

// A reviewer is credited only on published articles they completed, and only if they
// chose public recognition. Everyone else is never mentioned.
async function creditedReviewers(articleId: Types.ObjectId) {
  const assignments = await ReviewAssignment.find({ article: articleId, status: "completed" })
    .select("reviewer")
    .lean();
  const profiles = await ReviewerProfile.find({
    user: { $in: assignments.map((item) => item.reviewer) },
    publicRecognition: true,
  })
    .populate("user", "name")
    .lean<{ user: { _id: Types.ObjectId; name: string } | null }[]>();
  return profiles
    .filter((profile) => profile.user)
    .map((profile) => ({ id: String(profile.user!._id), name: profile.user!.name }));
}

// Totals for the home page. Counts only, so no individual contributor is revealed.
publicRouter.get("/stats", async (_req, res) => {
  const [publishedArticles, activeResearchers, researchAreas] = await Promise.all([
    Article.countDocuments({ status: "published" }),
    User.countDocuments({ role: { $in: ["writer", "reviewer"] }, isActive: { $ne: false } }),
    Category.countDocuments({ isActive: true }),
  ]);
  res.json({ data: { publishedArticles, activeResearchers, researchAreas } });
});

publicRouter.get("/articles", async (req, res) => {
  res.json(await listPublished(req.query));
});

publicRouter.get("/search", async (req, res) => {
  const { sort = "relevant", ...rest } = req.query as Record<string, unknown>;
  res.json(await listPublished({ ...rest, sort }));
});

publicRouter.get("/articles/:slug", async (req, res) => {
  const slug = parse(z.string().max(120), req.params.slug);
  const article = await Article.findOne({ slug, status: "published" })
    .populate(PUBLIC_POPULATE)
    .lean<ArticleDocument>();
  if (!article) throw notFoundError("Article");

  const [related, reviewers, rating] = await Promise.all([
    Article.find({ status: "published", category: article.category, _id: { $ne: article._id } })
      .select("-content -plainText")
      .sort({ publishedAt: -1 })
      .limit(3)
      .populate(PUBLIC_POPULATE)
      .lean<ArticleDocument[]>(),
    creditedReviewers(article._id),
    ratingSummary("article", article._id),
  ]);

  res.json({
    data: { ...toPublicArticle(article), related: related.map(toPublicArticleSummary), reviewers, rating },
  });
});

// Separate from the read above, so rendering metadata doesn't count as a view.
publicRouter.post("/articles/:slug/view", async (req, res) => {
  const slug = parse(z.string().max(120), req.params.slug);
  await Article.updateOne({ slug, status: "published" }, { $inc: { viewCount: 1 } }, { timestamps: false });
  res.status(204).end();
});

publicRouter.get("/categories", async (_req, res) => {
  const categories = await Category.find({ isActive: true })
    .select("name slug description image")
    .sort({ displayOrder: 1, name: 1 })
    .lean();
  const counts = await Article.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: "published" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((row) => [String(row._id), row.count]));
  res.json({
    data: categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image ?? null,
      articleCount: countById.get(String(category._id)) ?? 0,
    })),
  });
});

publicRouter.get("/categories/:slug", async (req, res) => {
  const slug = parse(z.string().max(120), req.params.slug);
  const category = await Category.findOne({ slug, isActive: true }).select("name slug description").lean();
  if (!category) throw notFoundError("Category");
  res.json({
    data: { id: String(category._id), name: category.name, slug: category.slug, description: category.description },
  });
});

publicRouter.get("/categories/:slug/articles", async (req, res) => {
  res.json(await listPublished({ ...req.query, category: req.params.slug }));
});

publicRouter.get("/authors/:id", async (req, res) => {
  const id = new Types.ObjectId(parse(objectId, req.params.id));
  const hasPublished = await Article.exists({ author: id, status: "published" });
  if (!hasPublished) throw notFoundError("Author");
  const user = await User.findById(id).select("name image bio expertise education socialLinks").lean();
  if (!user) throw notFoundError("Author");
  res.json({
    data: {
      id: String(user._id),
      name: user.name,
      image: user.image ?? null,
      bio: user.bio ?? "",
      expertise: user.expertise ?? [],
      ...toProfileExtras(user),
      rating: await ratingSummary("writer", id),
    },
  });
});

publicRouter.get("/authors/:id/articles", async (req, res) => {
  res.json(await listPublished({ ...req.query, author: req.params.id }));
});

async function publiclyCreditedArticleIds(reviewerId: Types.ObjectId) {
  const profile = await ReviewerProfile.exists({ user: reviewerId, publicRecognition: true });
  if (!profile) return null;
  const assignments = await ReviewAssignment.find({ reviewer: reviewerId, status: "completed" }).select("article").lean();
  const articles = await Article.find({ _id: { $in: assignments.map((item) => item.article) }, status: "published" })
    .select("-content -plainText")
    .sort({ publishedAt: -1 })
    .populate(PUBLIC_POPULATE)
    .lean<ArticleDocument[]>();
  return articles.length > 0 ? articles : null;
}

// Without public recognition this behaves exactly like a missing page, so the
// response never confirms that someone is a reviewer.
publicRouter.get("/reviewers/:id", async (req, res) => {
  const id = new Types.ObjectId(parse(objectId, req.params.id));
  const articles = await publiclyCreditedArticleIds(id);
  if (!articles) throw notFoundError("Reviewer");
  const user = await User.findById(id).select("name image bio expertise education socialLinks").lean();
  if (!user) throw notFoundError("Reviewer");
  res.json({
    data: {
      id: String(user._id),
      name: user.name,
      image: user.image ?? null,
      bio: user.bio ?? "",
      expertise: user.expertise ?? [],
      ...toProfileExtras(user),
      rating: await ratingSummary("reviewer", id),
      articles: articles.map(toPublicArticleSummary),
    },
  });
});

publicRouter.get("/articles/:slug/comments", async (req, res) => {
  const slug = parse(z.string().max(120), req.params.slug);
  const { page, limit } = parse(paginationSchema, req.query);
  const article = await Article.findOne({ slug, status: "published" }).select("_id").lean();
  if (!article) throw notFoundError("Article");
  const filter = { article: article._id, status: "approved" as const };
  const [rows, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name")
      .lean<{ _id: Types.ObjectId; content: string; createdAt: Date; user: { name: string } | null }[]>(),
    Comment.countDocuments(filter),
  ]);
  const data = rows.map((row) => ({
    id: String(row._id),
    content: row.content,
    author: row.user?.name ?? "Former member",
    createdAt: row.createdAt,
  }));
  res.json(paginated(data, total, page, limit));
});

publicRouter.post("/articles/:slug/comments", requireAuth, writeLimiter(10), async (req, res) => {
  const slug = parse(z.string().max(120), req.params.slug);
  const { content } = parse(z.object({ content: z.string().trim().min(2).max(2000) }), req.body);
  const article = await Article.findOne({ slug, status: "published" }).select("_id").lean();
  if (!article) throw notFoundError("Article");
  await Comment.create({ article: article._id, user: currentUser(req).id, content });
  res.status(201).json({ data: { status: "pending" }, message: "Your comment will appear after moderation." });
});

const ratingSchema = z.object({
  targetType: z.enum(RATING_TARGETS),
  targetId: objectId,
  score: z.number().int().min(1).max(5),
});

// Eligibility rules that prevent self-rating and retaliation.
// Ratings are never read by assignment or editorial decision code.
async function assertCanRate(userId: string, targetType: string, targetId: Types.ObjectId) {
  const deny = (message: string) => new AppError(403, "NOT_ELIGIBLE", message);
  const user = new Types.ObjectId(userId);

  if (targetType === "article") {
    const article = await Article.findOne({ _id: targetId, status: "published" }).select("author").lean();
    if (!article) throw notFoundError("Article");
    if (article.author.equals(user)) throw deny("You cannot rate your own article.");
    if (await ReviewAssignment.exists({ article: targetId, reviewer: user })) {
      throw deny("You cannot rate an article you were asked to review.");
    }
    return;
  }

  if (targetType === "writer") {
    if (targetId.equals(user)) throw deny("You cannot rate yourself.");
    if (!(await Article.exists({ author: targetId, status: "published" }))) throw notFoundError("Author");
    return;
  }

  if (targetId.equals(user)) throw deny("You cannot rate yourself.");
  const articles = await publiclyCreditedArticleIds(targetId);
  if (!articles) throw notFoundError("Reviewer");
  // A writer may not rate someone who reviewed their work.
  if (articles.some((article) => String(article.author && (article.author as unknown as { _id: unknown })._id) === userId)) {
    throw deny("You cannot rate a reviewer of your own article.");
  }
}

publicRouter.post("/ratings", requireAuth, writeLimiter(20), async (req, res) => {
  const { targetType, targetId, score } = parse(ratingSchema, req.body);
  const user = currentUser(req);
  const target = new Types.ObjectId(targetId);
  await assertCanRate(user.id, targetType, target);
  await Rating.updateOne(
    { user: user.id, targetType, targetId: target },
    { $set: { score }, $setOnInsert: { status: "visible" } },
    { upsert: true },
  );
  res.json({ data: { score, summary: await ratingSummary(targetType, target) } });
});
