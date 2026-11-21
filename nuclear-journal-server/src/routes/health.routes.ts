import { Router } from "express";

export const healthRouter = Router();

// Public endpoint, so it reports only that the API is alive. It must not reveal
// versions, configuration or internal details.
healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "nuclear-journal-api",
    timestamp: new Date().toISOString(),
  });
});
