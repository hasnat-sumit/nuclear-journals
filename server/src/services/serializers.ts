import type { Types } from "mongoose";
import { toWriterStatus, type ArticleStatus } from "../constants.js";

// CONFIDENTIALITY: each function builds a new object from a fixed list of fields.
// A field added to a model later cannot reach an audience until it is added here.

interface ArticleSource {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: { json?: unknown; html?: string } | null;
  coverImage?: { url?: string | null; publicId?: string | null; alt?: string | null } | null;
  category?: unknown;
  tags?: string[];
  references?: { citation?: string | null; url?: string | null }[] | null;
  declarations?: { author?: boolean; originality?: boolean; confidentiality?: boolean } | null;
  status: ArticleStatus;
  readingTime?: number;
  viewCount?: number;
  featured?: boolean;
  reviewRound?: number;
  version?: number;
  submittedAt?: Date | null;
  lastWriterEditAt?: Date | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  author?: unknown;
}

interface CategorySource {
  _id: Types.ObjectId;
  name: string;
  slug: string;
}

interface AuthorSource {
  _id: Types.ObjectId;
  name: string;
  image?: string | null;
  bio?: string | null;
}

function toCategory(value: unknown) {
  if (!value || typeof value !== "object" || !("slug" in value)) return null;
  const category = value as CategorySource;
  return { id: String(category._id), name: category.name, slug: category.slug };
}

function toCover(article: ArticleSource) {
  return article.coverImage?.url
    ? { url: article.coverImage.url, alt: article.coverImage.alt ?? "" }
    : null;
}

function toReferences(article: ArticleSource) {
  return (article.references ?? []).map(({ citation, url }) => ({ citation: citation ?? "", url: url ?? null }));
}

// Public author details. Never includes email, role or application data.
export function toPublicAuthor(author: unknown) {
  if (!author || typeof author !== "object" || !("name" in author)) return null;
  const value = author as AuthorSource;
  return { id: String(value._id), name: value.name, image: value.image ?? null, bio: value.bio ?? null };
}

export function toPublicArticleSummary(article: ArticleSource) {
  return {
    id: String(article._id),
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    coverImage: toCover(article),
    category: toCategory(article.category),
    author: toPublicAuthor(article.author),
    tags: article.tags ?? [],
    readingTime: article.readingTime ?? 1,
    featured: article.featured ?? false,
    publishedAt: article.publishedAt ?? null,
  };
}

export function toPublicArticle(article: ArticleSource) {
  return {
    ...toPublicArticleSummary(article),
    contentHtml: article.content?.html ?? "",
    references: toReferences(article),
    viewCount: article.viewCount ?? 0,
  };
}

// CONFIDENTIALITY: exposes the simplified status only, and no internal timestamps
// (`updatedAt`) or review data of any kind.
export function toWriterArticle(article: ArticleSource) {
  return {
    id: String(article._id),
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    contentJson: article.content?.json ?? null,
    contentHtml: article.content?.html ?? "",
    coverImage: article.coverImage?.url
      ? {
          url: article.coverImage.url,
          publicId: article.coverImage.publicId ?? "",
          alt: article.coverImage.alt ?? "",
        }
      : null,
    category: toCategory(article.category),
    tags: article.tags ?? [],
    references: toReferences(article),
    declarations: {
      author: article.declarations?.author ?? false,
      originality: article.declarations?.originality ?? false,
      confidentiality: article.declarations?.confidentiality ?? false,
    },
    status: toWriterStatus(article.status),
    readingTime: article.readingTime ?? 1,
    viewCount: article.status === "published" ? (article.viewCount ?? 0) : 0,
    version: article.version ?? 0,
    createdAt: article.createdAt ?? null,
    submittedAt: article.submittedAt ?? null,
    lastEditedAt: article.lastWriterEditAt ?? null,
    publishedAt: article.publishedAt ?? null,
  };
}

// What a reviewer needs to do the review. The author is deliberately left out.
export function toReviewerArticle(article: ArticleSource) {
  return {
    id: String(article._id),
    title: article.title,
    excerpt: article.excerpt ?? "",
    contentHtml: article.content?.html ?? "",
    coverImage: toCover(article),
    category: toCategory(article.category),
    tags: article.tags ?? [],
    references: toReferences(article),
    readingTime: article.readingTime ?? 1,
    reviewRound: article.reviewRound ?? 1,
  };
}

interface ProfileExtrasSource {
  education?: { university?: string | null; subject?: string | null; passingYear?: number | null }[] | null;
  socialLinks?: { platform?: string | null; url?: string | null }[] | null;
}

// Education and social links, copied field by field. Used for the user's own
// profile and for public writer and reviewer pages.
export function toProfileExtras(value: ProfileExtrasSource) {
  return {
    education: (value.education ?? []).map((item) => ({
      university: item.university ?? "",
      subject: item.subject ?? "",
      passingYear: item.passingYear ?? null,
    })),
    socialLinks: (value.socialLinks ?? []).map((item) => ({ platform: item.platform ?? "website", url: item.url ?? "" })),
  };
}
