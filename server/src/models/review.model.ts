import { Schema, model } from "mongoose";
import { RECOMMENDATIONS } from "../constants.js";

const score = { type: Number, min: 1, max: 5 };

const reviewSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignment: { type: Schema.Types.ObjectId, ref: "ReviewAssignment", required: true, unique: true },
    reviewRound: { type: Number, required: true },
    recommendation: { type: String, enum: RECOMMENDATIONS },
    criteria: {
      technicalAccuracy: score,
      clarity: score,
      relevance: score,
      references: score,
      overall: score,
    },
    comments: { type: String, default: "", maxlength: 10000 },
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    submittedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ article: 1, reviewRound: 1 });
reviewSchema.index({ reviewer: 1, status: 1 });

export const Review = model("Review", reviewSchema);
