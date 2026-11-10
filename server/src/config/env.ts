import { existsSync } from "node:fs";
import { z } from "zod";

// Local development reads server/.env. Hosting platforms set real environment
// variables instead, and those always win over values in the file.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// The browser sends an exact origin, and CORS compares it character by character.
// Rejecting "https://site.com/" here prevents a confusing failure later.
// URL.canParse comes first because `new URL` throws on bad input, and that error
// would print the raw value.
const exactOrigin = z
  .string()
  .refine((value) => URL.canParse(value) && new URL(value).origin === value, {
    message: "must be an exact origin with no path or trailing slash",
  });

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CLIENT_ORIGINS: z
      .string()
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .pipe(z.array(exactOrigin).min(1)),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27018/nuclear-journal"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "must be at least 32 characters")
      .default("local-development-only-secret-do-not-deploy"),
    // The public website address. The browser reaches the API through the website.
    BETTER_AUTH_URL: exactOrigin.default("http://localhost:3000"),
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().default("Nuclear Journal <no-reply@nuclearjournal.example>"),
    CLOUDINARY_URL: z.string().optional(),
    // Shared with the Next.js server only. See rate limiting in app.ts.
    INTERNAL_API_KEY: z.string().optional(),
    // "Continue with Google" is turned on only when both values are set.
    // Empty strings count as unset, so blank lines in .env are fine.
    GOOGLE_CLIENT_ID: z.string().trim().optional().transform((value) => value || undefined),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional().transform((value) => value || undefined),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: [value.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
        message: "set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
      });
    }
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;
    // Development defaults must never reach production.
    if (value.BETTER_AUTH_SECRET.startsWith("local-development")) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "must be set in production" });
    }
    if (value.MONGODB_URI.includes("127.0.0.1")) {
      ctx.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "must be set in production" });
    }
    if (
      !value.INTERNAL_API_KEY ||
      value.INTERNAL_API_KEY.length < 32 ||
      value.INTERNAL_API_KEY.startsWith("local-development")
    ) {
      ctx.addIssue({ code: "custom", path: ["INTERNAL_API_KEY"], message: "must be a private value of at least 32 characters in production" });
    }
    if (!value.SMTP_URL) {
      ctx.addIssue({ code: "custom", path: ["SMTP_URL"], message: "must be set in production" });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // Report which variables are wrong, but never print their values.
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = result.data;
