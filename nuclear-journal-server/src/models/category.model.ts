import { Schema, model } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "", maxlength: 500 },
    image: String,
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

categorySchema.index({ isActive: 1, displayOrder: 1 });

export const Category = model("Category", categorySchema);
