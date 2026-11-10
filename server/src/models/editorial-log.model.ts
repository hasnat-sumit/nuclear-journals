import { Schema, model } from "mongoose";

// Append-only audit trail. Editor-only. No route may update or delete these records.
const editorialLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    article: { type: Schema.Types.ObjectId, ref: "Article" },
    action: { type: String, required: true },
    previousStatus: String,
    newStatus: String,
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

editorialLogSchema.index({ createdAt: -1 });
editorialLogSchema.index({ article: 1, createdAt: -1 });

export const EditorialLog = model("EditorialLog", editorialLogSchema);
