import { Schema, model } from "mongoose";
import { COMMENT_STATUSES, RATING_STATUSES, RATING_TARGETS } from "../constants.js";

const bookmarkSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
bookmarkSchema.index({ user: 1, article: 1 }, { unique: true });
export const Bookmark = model("Bookmark", bookmarkSchema);

const commentSchema = new Schema(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: COMMENT_STATUSES, default: "pending" },
  },
  { timestamps: true, versionKey: false },
);
commentSchema.index({ article: 1, status: 1, createdAt: -1 });
commentSchema.index({ status: 1, createdAt: -1 });
export const Comment = model("Comment", commentSchema);

const ratingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: RATING_TARGETS, required: true },
    // An Article id for article ratings, otherwise a User id.
    targetId: { type: Schema.Types.ObjectId, required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    status: { type: String, enum: RATING_STATUSES, default: "visible" },
  },
  { timestamps: true, versionKey: false },
);
// One rating per person per target: rating again replaces the earlier score.
ratingSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
ratingSchema.index({ targetType: 1, targetId: 1, status: 1 });
export const Rating = model("Rating", ratingSchema);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, maxlength: 500 },
    link: String,
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = model("Notification", notificationSchema);
