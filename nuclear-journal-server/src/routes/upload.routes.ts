import { Router } from "express";
import { receiveImage, requireImageFile, uploadImage } from "../lib/images.js";
import { requireRole } from "../middleware/auth.js";

export { hasImageSignature } from "../lib/images.js";

export const uploadRouter = Router();

uploadRouter.post("/image", requireRole("writer", "editor"), receiveImage, async (req, res) => {
  const buffer = requireImageFile(req);
  const result = await uploadImage(buffer, { folder: "nuclear-journal" });
  res.status(201).json({ data: { url: result.secure_url, publicId: result.public_id } });
});
