import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

try {
  await connectDatabase();
} catch (error) {
  // The driver's message can include the connection host, so keep the log generic.
  console.error("API failed to connect to the database:", error instanceof Error ? error.name : "unknown error");
  process.exit(1);
}

const server = createApp().listen(env.PORT, (error) => {
  // Express 5 passes startup failures here, such as the port already being in use.
  if (error) {
    console.error(`API failed to start on port ${env.PORT}:`, error.message);
    process.exit(1);
  }
  console.log(`API listening on http://localhost:${env.PORT}/api/v1`);
});

// Hosting platforms send these signals on deploy. Finish in-flight requests first.
function shutdown() {
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
