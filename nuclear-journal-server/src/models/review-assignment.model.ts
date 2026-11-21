import { Schema, model } from "mongoose";
import { ACTIVE_ASSIGNMENT_STATUSES, ASSIGNMENT_STATUSES } from "../constants.js";

const reviewAssignmentSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignmentType: { type: String, enum: ["automatic", "manual"], required: true },
    reviewRound: { type: Number, required: true },
    status: { type: String, enum: ASSIGNMENT_STATUSES, default: "invited" },
    declineReason: { type: String, maxlength: 1000 }, // Editor-only.
    overrideReason: { type: String, maxlength: 1000 },
    dueDate: { type: Date, required: true },
    acceptedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

reviewAssignmentSchema.index({ reviewer: 1, status: 1 });
reviewAssignmentSchema.index({ article: 1, reviewRound: 1, status: 1 });
reviewAssignmentSchema.index({ status: 1, dueDate: 1 });
// One live invitation per reviewer per article.
reviewAssignmentSchema.index(
  { article: 1, reviewer: 1 },
  { unique: true, partialFilterExpression: { status: { $in: [...ACTIVE_ASSIGNMENT_STATUSES] } } },
);

export const ReviewAssignment = model("ReviewAssignment", reviewAssignmentSchema);
