import { Schema, model } from "mongoose";

// The official feedback an editor releases to a writer with a decision. This is the
// only editorial commentary a writer can read; reviews are never exposed directly.
const articleFeedbackSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true, index: true },
    decision: { type: String, enum: ["revision_requested", "approved", "rejected"], required: true },
    message: { type: String, default: "", maxlength: 10000 },
    reviewRound: { type: Number, required: true },
    editor: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const ArticleFeedback = model("ArticleFeedback", articleFeedbackSchema);
