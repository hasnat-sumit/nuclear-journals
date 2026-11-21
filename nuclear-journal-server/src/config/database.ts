import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri: string = env.MONGODB_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await ensureAuthIndexes();
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

// Better Auth creates its collections but not their indexes.
async function ensureAuthIndexes() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not ready");
  await db.collection("session").createIndex({ token: 1 }, { unique: true });
  await db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("account").createIndex({ userId: 1 });
  await db.collection("verification").createIndex({ identifier: 1 });
}
