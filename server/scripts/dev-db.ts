// A real MongoDB for local development, with no Atlas account needed.
// Data is kept in server/.dev-db between runs. Never used in production.
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = ".dev-db";
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: 27018, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
});

console.log(`Development database running at ${server.getUri()}`);

async function stop() {
  await server.stop({ doCleanup: false });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
