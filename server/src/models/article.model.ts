import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { ARTICLE_STATUSES, type ArticleStatus } from "../constants.js";

const articleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: "", maxlength: 500 },
    content: {
      // Tiptap JSON is the canonical form; html is sanitized on the server.
      json: { type: Schema.Types.Mixed, default: null },
      html: { type: String, default: "" },
    },
    plainText: { type: String, default: "", select: false },
    coverImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category" },
    tags: { type: [String], default: [] },
    references: {
      type: [{ _id: false, citation: { type: String, required: true }, url: String }],
      default: [],
    },
    declarations: {
      author: { type: Boolean, default: false },
      originality: { type: Boolean, default: false },
      confidentiality: { type: Boolean, default: false },
      confirmedAt: Date,
    },
    status: { type: String, enum: ARTICLE_STATUSES, default: "draft", required: true },
    featured: { type: Boolean, default: false },
    readingTime: { type: Number, default: 1 },
    viewCount: { type: Number, default: 0 },
    reviewRound: { type: Number, default: 1 },
    version: { type: Number, default: 0 },
    // CONFIDENTIALITY: writers see these dates, never `updatedAt`, because internal
    // events such as reviewer assignment change `updatedAt`.
    submittedAt: Date,
    lastWriterEditAt: Date,
    publishedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ author: 1, status: 1 });
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });
articleSchema.index({ tags: 1, status: 1 });
articleSchema.index({ status: 1, featured: 1, publishedAt: -1 });
articleSchema.index(
  { title: "text", excerpt: "text", tags: "text", plainText: "text" },
  { weights: { title: 10, tags: 5, excerpt: 3, plainText: 1 }, name: "article_search" },
);

export type ArticleDocument = InferSchemaType<typeof articleSchema> & {
  _id: Types.ObjectId;
  status: ArticleStatus;
  createdAt: Date;
  updatedAt: Date;
};
export const Article = model("Article", articleSchema);
