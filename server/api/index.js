// Vercel entry point. Vercel runs the API as a function instead of a long-running
// server, so there is no app.listen here: each request is handed to the same
// Express app that `npm run dev` uses. `npm run build` compiles src/ to dist/ first.
import { createApp } from "../dist/app.js";
import { connectDatabase } from "../dist/config/database.js";

const app = createApp();

// A warm function instance keeps its database connection between requests,
// so only the first request after a cold start pays for connecting.
let ready;

export default async function handler(req, res) {
  // The health check never touches the database, so it answers even when the database is down.
  if (req.url?.startsWith("/api/v1/health")) return app(req, res);

  ready ??= connectDatabase().catch((error) => {
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
