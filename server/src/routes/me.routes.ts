import { Router } from "express";
import { z } from "zod";
import { APPLICATION_TYPES, CONTRIBUTOR_ROLES, SOCIAL_PLATFORMS, type ApplicationType, type Role } from "../constants.js";
import { AppError, notFoundError, objectId, paginated, paginationSchema, parse } from "../lib/http.js";
import { deleteImage, receiveImage, requireImageFile, uploadImage } from "../lib/images.js";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { Article } from "../models/article.model.js";
import { Bookmark, Notification, Rating } from "../models/engagement.models.js";
import { User } from "../models/user.model.js";
import { notifyEditors } from "../services/notifications.js";
import { toProfileExtras, toPublicArticleSummary } from "../services/serializers.js";

export const meRouter = Router();
meRouter.use(requireAuth);

const applicationView = (application?: {
  status: string;
  submittedAt: Date;
  decisionNote?: string | null;
} | null) =>
  application
    ? { status: application.status, submittedAt: application.submittedAt, decisionNote: application.decisionNote ?? null }
    : null;

meRouter.get("/", async (req, res) => {
  const user = await User.findById(currentUser(req).id).lean();
  if (!user) throw notFoundError("User");
  res.json({
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role: user.role,
      bio: user.bio ?? "",
      expertise: user.expertise ?? [],
      ...toProfileExtras(user),
      writerApplication: applicationView(user.writerApplication),
      reviewerApplication: applicationView(user.reviewerApplication),
    },
  });
});

const MAX_EDUCATION = 10;
const MAX_SOCIAL_LINKS = 10;

// Links are shown on public pages, so only real web addresses are accepted.
// This rules out javascript: and data: links.
const webUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol), {
    message: "must be a full web address starting with https://",
  });

const educationSchema = z.object({
  university: z.string().trim().min(2, "enter the university").max(150),
  subject: z.string().trim().min(2, "enter the subject").max(120),
  // Up to ten years ahead, for people still studying.
  passingYear: z.coerce
    .number()
    .int()
    .min(1950)
    .refine((year) => year <= new Date().getFullYear() + 10, { message: "is too far in the future" }),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  bio: z.string().trim().max(1000).optional(),
  expertise: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  education: z.array(educationSchema).max(MAX_EDUCATION).optional(),
  socialLinks: z
    .array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: webUrl }))
    .max(MAX_SOCIAL_LINKS)
    .optional(),
});

const isContributor = (role: Role) => (CONTRIBUTOR_ROLES as readonly Role[]).includes(role);

meRouter.patch("/", async (req, res) => {
  const update = parse(profileSchema, req.body);
  const user = currentUser(req);
  if ((update.education || update.socialLinks) && !isContributor(user.role)) {
    throw new AppError(403, "FORBIDDEN", "Education and social links are for writers, reviewers and editors.");
  }
  await User.updateOne({ _id: user.id }, { $set: update });
  res.json({ data: { updated: true } });
});

const requireContributor = requireRole(...CONTRIBUTOR_ROLES);

// Cropped to a square around the face, so it looks right in every round avatar.
meRouter.post("/photo", requireContributor, receiveImage, async (req, res) => {
  const buffer = requireImageFile(req);
  const user = currentUser(req);
  const result = await uploadImage(buffer, {
    folder: "nuclear-journal/avatars",
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  });
  const previous = await User.findOneAndUpdate(
    { _id: user.id },
    { $set: { image: result.secure_url, imagePublicId: result.public_id } },
  )
    .select("imagePublicId")
    .lean();
  await deleteImage(previous?.imagePublicId);
  res.status(201).json({ data: { image: result.secure_url } });
});

meRouter.delete("/photo", requireContributor, async (req, res) => {
  const previous = await User.findOneAndUpdate(
    { _id: currentUser(req).id },
    { $unset: { image: "", imagePublicId: "" } },
  )
    .select("imagePublicId")
    .lean();
  await deleteImage(previous?.imagePublicId);
  res.json({ data: { image: null } });
});

const applicationSchema = z.object({
  statement: z.string().trim().min(50, "must be at least 50 characters").max(2000),
  credentials: z.string().trim().max(1000).optional(),
});

// Each account holds one role, so only readers can apply.
meRouter.post("/applications/:type", async (req, res) => {
  const type: ApplicationType = parse(z.enum(APPLICATION_TYPES), req.params.type);
  const body = parse(applicationSchema, req.body);
  const user = currentUser(req);
  if (user.role !== "reader") {
    throw new AppError(409, "ALREADY_HAS_ROLE", "Your account already has a contributor role.");
  }

  const stored = await User.findById(user.id).select("writerApplication reviewerApplication").lean();
  if (stored?.writerApplication?.status === "pending" || stored?.reviewerApplication?.status === "pending") {
    throw new AppError(409, "APPLICATION_PENDING", "You already have an application waiting for review.");
  }

  await User.updateOne(
    { _id: user.id },
    { $set: { [`${type}Application`]: { ...body, status: "pending", submittedAt: new Date() } } },
  );
  await notifyEditors(`${user.name} applied to become a ${type}.`, "/dashboard/editor/applications");
  res.status(201).json({ data: { status: "pending" } });
});

meRouter.get("/bookmarks", async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const published = await Article.find({ status: "published" }).select("_id").lean();
  const filter = { user: currentUser(req).id, article: { $in: published.map((item) => item._id) } };
  const [rows, total] = await Promise.all([
    Bookmark.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "article",
        select: "-content -plainText",
        populate: [
          { path: "category", select: "name slug" },
          { path: "author", select: "name image bio" },
        ],
      })
      .lean<{ article: Parameters<typeof toPublicArticleSummary>[0] }[]>(),
    Bookmark.countDocuments(filter),
  ]);
  res.json(paginated(rows.map((row) => toPublicArticleSummary(row.article)), total, page, limit));
});

meRouter.get("/bookmarks/:articleId", async (req, res) => {
  const article = parse(objectId, req.params.articleId);
  const exists = await Bookmark.exists({ user: currentUser(req).id, article });
  res.json({ data: { bookmarked: Boolean(exists) } });
});

meRouter.put("/bookmarks/:articleId", async (req, res) => {
  const article = parse(objectId, req.params.articleId);
  const isPublished = await Article.exists({ _id: article, status: "published" });
  if (!isPublished) throw notFoundError("Article");
  await Bookmark.updateOne(
    { user: currentUser(req).id, article },
    { $setOnInsert: { user: currentUser(req).id, article } },
    { upsert: true },
  );
  res.json({ data: { bookmarked: true } });
});

meRouter.delete("/bookmarks/:articleId", async (req, res) => {
  const article = parse(objectId, req.params.articleId);
  await Bookmark.deleteOne({ user: currentUser(req).id, article });
  res.json({ data: { bookmarked: false } });
});

meRouter.get("/notifications", async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = { user: currentUser(req).id };
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  const data = rows.map((row) => ({
    id: String(row._id),
    message: row.message,
    link: row.link ?? null,
    read: Boolean(row.readAt),
    createdAt: row.createdAt,
  }));
  res.json({ ...paginated(data, total, page, limit), unread });
});

meRouter.post("/notifications/read-all", async (req, res) => {
  await Notification.updateMany({ user: currentUser(req).id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ data: { updated: true } });
});

meRouter.get("/ratings/:targetType/:targetId", async (req, res) => {
  const rating = await Rating.findOne({
    user: currentUser(req).id,
    targetType: parse(z.enum(["article", "writer", "reviewer"]), req.params.targetType),
    targetId: parse(objectId, req.params.targetId),
  })
    .select("score")
    .lean();
  res.json({ data: { score: rating?.score ?? null } });
});
