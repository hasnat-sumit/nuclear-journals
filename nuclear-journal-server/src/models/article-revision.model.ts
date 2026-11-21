import { Schema, model } from "mongoose";

const articleRevisionSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    excerpt: String,
    content: { json: Schema.Types.Mixed, html: String },
    references: { type: [{ _id: false, citation: String, url: String }], default: [] },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changeSummary: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

articleRevisionSchema.index({ article: 1, version: 1 }, { unique: true });

export const ArticleRevision = model("ArticleRevision", articleRevisionSchema);
