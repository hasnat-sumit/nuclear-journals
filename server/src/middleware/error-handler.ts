import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/http.js";

// Libraries such as express.json() mark client mistakes with a 4xx `status`.
function getClientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) {
    return undefined;
  }
  const { status } = err;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : undefined;
}

function isDuplicateKeyError(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}

// Express recognises an error handler by its four parameters, so `_next` must stay.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (isDuplicateKeyError(err)) {
    res.status(409).json({
      error: { code: "CONFLICT", message: "This value is already in use." },
    });
    return;
  }

  const clientStatus = getClientErrorStatus(err);

  if (clientStatus !== undefined) {
    // Fixed message: parser errors can quote the raw request body back.
    res.status(clientStatus).json({
      error: { code: "BAD_REQUEST", message: "The request could not be processed." },
    });
    return;
  }

  // Full details go to the server log only. The client gets a generic message,
  // so stack traces and internal data never leave the server.
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
}
