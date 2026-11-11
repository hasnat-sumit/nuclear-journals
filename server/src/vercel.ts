// Vercel entry point. Vercel runs the API as a function instead of a long-running
// server, so there is no app.listen here: each request is handed to the same
// Express app that `npm run dev` uses. scripts/build-vercel.mjs bundles this file
// into dist/vercel-handler.js, which api/index.js re-exports.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";

const app = createApp();

// A warm function instance keeps its database connection between requests,
// so only the first request after a cold start pays for connecting.
let ready: Promise<unknown> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // The root and health routes never touch the database, so they answer even when it is down.
  if (req.url === "/" || req.url === "/api/v1" || req.url?.startsWith("/api/v1/health")) return app(req, res);

  ready ??= connectDatabase().catch((error: unknown) => {
    ready = undefined; // let the next request try again
    throw error;
  });
  try {
    await ready;
  } catch (error) {
    // The driver's message can include the connection host, so keep the log generic.
    console.error("API failed to connect to the database:", error instanceof Error ? error.name : "unknown error");
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { code: "DATABASE_UNAVAILABLE", message: "The service is temporarily unavailable." } }));
    return;
  }
  return app(req, res);
}
