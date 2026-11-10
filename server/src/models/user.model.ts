import { Schema, model, type InferSchemaType } from "mongoose";
import { APPLICATION_STATUSES, ROLES, SOCIAL_PLATFORMS } from "../constants.js";

const applicationSchema = new Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    statement: { type: String, required: true, maxlength: 2000 },
    credentials: { type: String, maxlength: 1000 },
    submittedAt: { type: Date, required: true },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decisionNote: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const educationSchema = new Schema(
  {
    university: { type: String, required: true, maxlength: 150 },
    subject: { type: String, required: true, maxlength: 120 },
    passingYear: { type: Number, required: true },
  },
  { _id: false },
);

const socialLinkSchema = new Schema(
  {
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true },
    url: { type: String, required: true, maxlength: 300 },
  },
  { _id: false },
);

// This model reads and extends the "user" collection owned by Better Auth.
// Better Auth creates accounts, emails and passwords; never create users through
// this model. Timestamps are managed by Better Auth as well.
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: String,
    role: { type: String, enum: ROLES, default: "reader", index: true },
    isActive: { type: Boolean, default: true },
    bio: { type: String, maxlength: 1000 },
    expertise: { type: [String], default: [] },
    education: { type: [educationSchema], default: [] },
    socialLinks: { type: [socialLinkSchema], default: [] },
    // Set only for photos uploaded here, so the old file can be removed from Cloudinary.
    // Photos that came from Google have no public id.
    imagePublicId: String,
    writerApplication: applicationSchema,
    reviewerApplication: applicationSchema,
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: "user", versionKey: false },
);

userSchema.index({ "writerApplication.status": 1 });
userSchema.index({ "reviewerApplication.status": 1 });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
