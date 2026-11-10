import { Schema, model, type InferSchemaType } from "mongoose";
import { DEFAULT_MAX_PENDING_REVIEWS, PROFICIENCY_LEVELS } from "../constants.js";

const reviewerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    expertise: {
      type: [
        {
          _id: false,
          category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
          proficiency: { type: String, enum: PROFICIENCY_LEVELS, required: true },
        },
      ],
      default: [],
    },
    excludedTopics: { type: [{ type: Schema.Types.ObjectId, ref: "Category" }], default: [] },
    // Authors this reviewer has declared a conflict of interest with.
    conflictedAuthors: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    availability: { type: String, enum: ["available", "unavailable"], default: "unavailable" },
    unavailableUntil: Date,
    unavailableReason: { type: String, maxlength: 500 }, // Editor-only.
    maxPendingReviews: { type: Number, default: DEFAULT_MAX_PENDING_REVIEWS, min: 1, max: 10 },
    publicRecognition: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

reviewerProfileSchema.index({ isActive: 1, availability: 1 });

export type ReviewerProfileDocument = InferSchemaType<typeof reviewerProfileSchema>;
export const ReviewerProfile = model("ReviewerProfile", reviewerProfileSchema);
