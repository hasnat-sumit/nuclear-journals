import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { toWriterStatus, type ArticleStatus, type WriterStatus } from "../constants.js";
import { countWords, isCloudinaryUrl, readingTimeMinutes, sanitizeArticleHtml, toPlainText } from "../lib/content.js";
import { AppError, notFoundError, objectId, paginated, paginationSchema, parse, slugSchema, toSlug } from "../lib/http.js";
import { currentUser, requireRole } from "../middleware/auth.js";
import { ArticleFeedback } from "../models/article-feedback.model.js";
import { Article, type ArticleDocument } from "../models/article.model.js";
import { ArticleRevision } from "../models/article-revision.model.js";
import { Category } from "../models/category.model.js";
import { notifyEditors } from "../services/notifications.js";
import { toWriterArticle } from "../services/serializers.js";
import { transitionArticle } from "../services/workflow.js";

export const writerRouter = Router();
writerRouter.use(requireRole("writer"));

const MIN_SUBMISSION_WORDS = 100;
const EDITABLE_STATUSES = ["draft", "revision_requested"] as const;

const articleBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(500).optional(),
  categoryId: objectId.nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10).optional(),
  references: z
    .array(z.object({ citation: z.string().trim().min(3).max(1000), url: z.url().nullable().optional() }))
    .max(100)
    .optional(),
  contentJson: z.looseObject({ type: z.literal("doc") }).nullable().optional(),
  contentHtml: z.string().max(1_000_000).optional(),
  coverImage: z
    .object({
      url: z.url().refine(isCloudinaryUrl, "must be an uploaded image"),
      publicId: z.string().max(300),
      alt: z.string().trim().max(300),
    })
    .nullable()
    .optional(),
  declarations: z
    .object({ author: z.boolean(), originality: z.boolean(), confidentiality: z.boolean() })
    .optional(),
});

async function uniqueSlug(title: string) {
  const base = toSlug(title) || "article";
  let candidate = base;
  for (let suffix = 2; await Article.exists({ slug: candidate }); suffix += 1) {
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

// Turns validated input into database fields. Sanitizing here means unsafe HTML
// can never be stored, whatever a client sends.
async function toArticleFields(body: Partial<z.output<typeof articleBodySchema>>) {
  const fields: Record<string, unknown> = { lastWriterEditAt: new Date() };

  if (body.title !== undefined) fields.title = body.title;
  if (body.slug !== undefined) fields.slug = body.slug;
  if (body.excerpt !== undefined) fields.excerpt = body.excerpt;
  if (body.tags !== undefined) fields.tags = [...new Set(body.tags)];
  if (body.references !== undefined) fields.references = body.references;
  if (body.coverImage !== undefined) fields.coverImage = body.coverImage ?? { url: null, publicId: null, alt: null };
  if (body.contentJson !== undefined) fields["content.json"] = body.contentJson;
  if (body.declarations !== undefined) fields.declarations = body.declarations;

  if (body.categoryId !== undefined) {
    if (body.categoryId && !(await Category.exists({ _id: body.categoryId, isActive: true }))) {
      throw new AppError(400, "VALIDATION_ERROR", "Please choose an active category.");
    }
    fields.category = body.categoryId;
  }
  if (body.contentHtml !== undefined) {
    const html = sanitizeArticleHtml(body.contentHtml);
    const plainText = toPlainText(html);
    fields["content.html"] = html;
    fields.plainText = plainText;
    fields.readingTime = readingTimeMinutes(plainText);
  }
  return fields;
}

async function findOwnArticle(id: unknown, authorId: string) {
  const article = await Article.findOne({ _id: parse(objectId, id), author: authorId })
    .select("+plainText")
    .populate("category", "name slug")
    .lean<ArticleDocument>();
  // Someone else's article looks the same as a missing one.
  if (!article) throw notFoundError("Article");
  return article;
}

function assertReadyToSubmit(article: ArticleDocument) {
  const problems: string[] = [];
  if (!article.excerpt || article.excerpt.length < 20) problems.push("Add a summary of at least 20 characters.");
  if (!article.category) problems.push("Choose a main category.");
  if (countWords(article.plainText ?? "") < MIN_SUBMISSION_WORDS) {
    problems.push(`Write at least ${MIN_SUBMISSION_WORDS} words.`);
  }
  if (article.coverImage?.url && !article.coverImage.alt) problems.push("Add alt text for the cover image.");
  const { author, originality, confidentiality } = article.declarations ?? {};
  if (!author || !originality || !confidentiality) problems.push("Confirm all three declarations.");
  if (problems.length > 0) {
    throw new AppError(422, "NOT_READY", "The article is not ready to submit.", problems);
  }
}

function snapshot(article: ArticleDocument, editedBy: string, version: number, changeSummary: string) {
  return ArticleRevision.create({
    article: article._id,
    version,
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    references: article.references,
    editedBy,
    changeSummary,
  });
}

writerRouter.get("/articles", async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = { author: currentUser(req).id };
  const [rows, total] = await Promise.all([
    Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("category", "name slug")
      .lean<ArticleDocument[]>(),
    Article.countDocuments(filter),
  ]);
  res.json(paginated(rows.map(toWriterArticle), total, page, limit));
});

// Counts by writer-visible status only. Internal stages are merged before
// counting, so totals never reveal reviewer activity.
writerRouter.get("/stats", async (req, res) => {
  const groups = await Article.aggregate<{ _id: ArticleStatus; count: number }>([
    { $match: { author: new Types.ObjectId(currentUser(req).id) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts: Record<WriterStatus, number> = {
    draft: 0,
    pending_review: 0,
    revision_requested: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    archived: 0,
    unpublished: 0,
  };
  let total = 0;
  for (const group of groups) {
    counts[toWriterStatus(group._id)] += group.count;
    total += group.count;
  }
  res.json({ data: { total, ...counts } });
});

writerRouter.post("/articles", async (req, res) => {
  const body = parse(articleBodySchema, req.body);
  const fields = await toArticleFields(body);
  const article = await new Article({
    ...expandDotted(fields),
    slug: body.slug ?? (await uniqueSlug(body.title)),
    author: currentUser(req).id,
    status: "draft",
  }).save();
  res.status(201).json({ data: toWriterArticle(article.toObject() as unknown as ArticleDocument) });
});

// `Article.create` needs nested objects, whereas updates use "content.html" paths.
function expandDotted(fields: Record<string, unknown>) {
  const { "content.json": json, "content.html": html, ...rest } = fields;
  return { ...rest, content: { json: json ?? null, html: html ?? "" } };
}

writerRouter.get("/articles/:id", async (req, res) => {
  const article = await findOwnArticle(req.params.id, currentUser(req).id);
  res.json({ data: toWriterArticle(article) });
});

writerRouter.patch("/articles/:id", async (req, res) => {
  const user = currentUser(req);
  const id = parse(objectId, req.params.id);
  const body = parse(articleBodySchema.partial(), req.body);
  const fields = await toArticleFields(body);

  const updated = await Article.findOneAndUpdate(
    { _id: id, author: user.id, status: { $in: [...EDITABLE_STATUSES] } },
    { $set: fields },
    { returnDocument: "after", runValidators: true },
  )
    .populate("category", "name slug")
    .lean<ArticleDocument>();

  if (!updated) {
    await findOwnArticle(id, user.id);
    throw new AppError(409, "NOT_EDITABLE", "This article cannot be edited at its current stage.");
  }
  res.json({ data: toWriterArticle(updated) });
});

writerRouter.delete("/articles/:id", async (req, res) => {
  const user = currentUser(req);
  const id = parse(objectId, req.params.id);
  const { deletedCount } = await Article.deleteOne({ _id: id, author: user.id, status: "draft" });
  if (deletedCount === 0) {
    await findOwnArticle(id, user.id);
    throw new AppError(409, "NOT_EDITABLE", "Only drafts can be deleted.");
  }
  res.json({ data: { deleted: true } });
});

writerRouter.post("/articles/:id/submit", async (req, res) => {
  const user = currentUser(req);
  const article = await findOwnArticle(req.params.id, user.id);
  assertReadyToSubmit(article);

  const version = (article.version ?? 0) + 1;
  const now = new Date();
  await transitionArticle({
    articleId: String(article._id),
    from: ["draft"],
    to: "submitted",
    actorId: user.id,
    action: "submit",
    set: { version, submittedAt: now, "declarations.confirmedAt": now },
  });
  await snapshot(article, user.id, version, "Initial submission");
  await notifyEditors(`New submission: "${article.title}".`, `/dashboard/editor/articles/${String(article._id)}`);
  res.json({ data: toWriterArticle(await findOwnArticle(String(article._id), user.id)) });
});

const resubmitSchema = z.object({ changeSummary: z.string().trim().max(1000).optional() });

writerRouter.post("/articles/:id/resubmit", async (req, res) => {
  const user = currentUser(req);
  const { changeSummary } = parse(resubmitSchema, req.body ?? {});
  const article = await findOwnArticle(req.params.id, user.id);
  assertReadyToSubmit(article);

  const version = (article.version ?? 0) + 1;
  await transitionArticle({
    articleId: String(article._id),
    from: ["revision_requested"],
    to: "resubmitted",
    actorId: user.id,
    action: "resubmit",
    set: { version, submittedAt: new Date() },
    inc: { reviewRound: 1 },
  });
  await snapshot(article, user.id, version, changeSummary ?? "Revised after editorial feedback");
  await notifyEditors(`Resubmitted: "${article.title}".`, `/dashboard/editor/articles/${String(article._id)}`);
  res.json({ data: toWriterArticle(await findOwnArticle(String(article._id), user.id)) });
});

// CONFIDENTIALITY: this reads ArticleFeedback only, never Review or ReviewAssignment.
writerRouter.get("/articles/:id/feedback", async (req, res) => {
  const article = await findOwnArticle(req.params.id, currentUser(req).id);
  const rows = await ArticleFeedback.find({ article: article._id }).sort({ createdAt: -1 }).lean();
  res.json({
    data: rows.map((row) => ({
      id: String(row._id),
      decision: row.decision,
      message: row.message,
      createdAt: row.createdAt,
    })),
  });
});

writerRouter.get("/articles/:id/revisions", async (req, res) => {
  const article = await findOwnArticle(req.params.id, currentUser(req).id);
  const rows = await ArticleRevision.find({ article: article._id }).sort({ version: -1 }).lean();
  res.json({
    data: rows.map((row) => ({
      id: String(row._id),
      version: row.version,
      title: row.title,
      changeSummary: row.changeSummary,
      createdAt: row.createdAt,
    })),
  });
});
