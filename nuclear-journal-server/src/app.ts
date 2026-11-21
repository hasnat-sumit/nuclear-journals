import { toNodeHandler } from "better-auth/node";
import { createHash, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { getAuth } from "./lib/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { adminRouter } from "./routes/admin.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { meRouter } from "./routes/me.routes.js";
import { publicRouter } from "./routes/public.routes.js";
import { reviewerRouter } from "./routes/reviewer.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { writerRouter } from "./routes/writer.routes.js";

const API_PREFIX = "/api/v1";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Defence in depth against cross-site requests that carry a login cookie: if a
// browser says a state-changing request came from another website, refuse it.
function rejectForeignOrigins(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (UNSAFE_METHODS.has(req.method) && origin && !env.CLIENT_ORIGINS.includes(origin)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "This request origin is not allowed." } });
    return;
  }
  next();
}

// Server-rendered pages all reach the API from the website server's single address.
// Without this exemption they would share one rate limit, and ordinary traffic could
// take the public site down. Hashing makes the comparison constant-time at any length.
function isInternalRequest(req: Request) {
  const provided = req.headers["x-internal-api-key"];
  if (!env.INTERNAL_API_KEY || typeof provided !== "string") return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(provided), hash(env.INTERNAL_API_KEY));
}

// Builds the app without starting a network listener, so tests can use it directly.
// Middleware runs top to bottom for every request, so the order below matters.
export function createApp(options: { rateLimitMax?: number } = {}) {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGINS, credentials: true }));

  // Before the rate limiter, so hosting platform uptime checks are never blocked.
  app.use(`${API_PREFIX}/health`, healthRouter);

  // Opening the API's bare address in a browser should say it is running, not "not found".
  app.get(["/", API_PREFIX], (_req, res) => {
    res.json({ service: "nuclear-journal-api", status: "ok", health: `${API_PREFIX}/health` });
  });

  app.use(
    rateLimit({
      windowMs: FIFTEEN_MINUTES_MS,
      limit: options.rateLimitMax ?? env.RATE_LIMIT_MAX,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: isInternalRequest,
      message: {
        error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      },
    }),
  );

  app.use(rejectForeignOrigins);

  // Above express.json(), because Better Auth reads the raw request body itself.
  app.all(`${API_PREFIX}/auth/*splat`, (req, res) => toNodeHandler(getAuth())(req, res));

  // Large enough for a long article sent as both Tiptap JSON and HTML.
  app.use(express.json({ limit: "3mb" }));

  app.use(API_PREFIX, publicRouter);
  app.use(`${API_PREFIX}/me`, meRouter);
  app.use(`${API_PREFIX}/writer`, writerRouter);
  app.use(`${API_PREFIX}/reviewer`, reviewerRouter);
  app.use(`${API_PREFIX}/admin`, adminRouter);
  app.use(`${API_PREFIX}/uploads`, uploadRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
