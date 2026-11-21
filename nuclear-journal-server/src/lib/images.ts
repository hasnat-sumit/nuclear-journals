import { v2 as cloudinary } from "cloudinary";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "./http.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

// Reads one file from the multipart field "image" into memory.
export function receiveImage(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (error: unknown) => {
    if (error) {
      next(new AppError(400, "INVALID_UPLOAD", "Upload one image of 5 MB or less."));
      return;
    }
    next();
  });
}

// Browsers and clients can lie about a file's type and name, so check the bytes.
export function hasImageSignature(data: Buffer) {
  const isJpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP";
  return isJpeg || isPng || isWebp;
}

// Validates the received file and returns its bytes, or throws a user-facing error.
export function requireImageFile(req: Request): Buffer {
  if (!req.file || !hasImageSignature(req.file.buffer)) {
    throw new AppError(400, "INVALID_UPLOAD", "Only JPEG, PNG and WebP images are allowed.");
  }
  if (!env.CLOUDINARY_URL) {
    throw new AppError(503, "UPLOADS_UNAVAILABLE", "Image uploads are not configured yet.");
  }
  return req.file.buffer;
}

export function uploadImage(
  buffer: Buffer,
  options: { folder: string; transformation?: Record<string, unknown>[] },
) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ ...options, resource_type: "image" }, (error, value) => {
        if (error || !value) reject(new Error("Image upload failed"));
        else resolve(value);
      })
      .end(buffer);
  });
}

// Best effort: a leftover file in Cloudinary is harmless, so never fail the request.
export async function deleteImage(publicId: string | null | undefined) {
  if (!publicId || !env.CLOUDINARY_URL) return;
  await cloudinary.uploader.destroy(publicId).catch(() => undefined);
}
