import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import type { Role } from "../src/constants.js";
import { Category } from "../src/models/category.model.js";
import { ReviewerProfile } from "../src/models/reviewer-profile.model.js";
import { User } from "../src/models/user.model.js";

export const ORIGIN = "http://localhost:3000";
export const PASSWORD = "Correct-Horse-Battery-9";

let server: MongoMemoryServer;

export async function startDatabase() {
  server = await MongoMemoryServer.create();
  await connectDatabase(server.getUri("test"));
}

export async function stopDatabase() {
  await disconnectDatabase();
  await server.stop();
}

// Tests make many requests from one address, so the limiter gets its own test in app.test.ts.
export const app = () => createApp({ rateLimitMax: 1_000_000 });
export type Agent = ReturnType<typeof request.agent>;

let counter = 0;

// Registers through the real auth API, then signs in, so tests use real sessions.
export async function signUp(testApp: ReturnType<typeof createApp>, role: Role = "reader", name?: string) {
  counter += 1;
  const email = `user${counter}@example.com`;
  const agent = request.agent(testApp);
  agent.set("Origin", ORIGIN);

  const created = await agent
    .post("/api/v1/auth/sign-up/email")
    .send({ name: name ?? `User ${counter}`, email, password: PASSWORD });
  if (created.status !== 200) throw new Error(`Sign up failed: ${created.status} ${created.text}`);

  await User.updateOne({ email }, { $set: { role, emailVerified: true } });

  const signedIn = await agent.post("/api/v1/auth/sign-in/email").send({ email, password: PASSWORD });
  if (signedIn.status !== 200) throw new Error(`Sign in failed: ${signedIn.status} ${signedIn.text}`);

  const user = await User.findOne({ email }).lean();
  return { agent, id: String(user!._id), email };
}

export async function createCategory(name = "Nuclear Safety") {
  const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${(counter += 1)}`;
  const category = await Category.create({ name, slug });
  return String(category._id);
}

export async function makeReviewerAvailable(userId: string, categoryId: string, proficiency = "expert") {
  await ReviewerProfile.updateOne(
    { user: userId },
    { $set: { availability: "available", expertise: [{ category: categoryId, proficiency }] } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export const LONG_HTML = `<p>${"Reliable nuclear knowledge. ".repeat(50)}</p>`;

export function validArticle(categoryId: string, title = "Understanding Decay Heat") {
  return {
    title,
    excerpt: "A clear introduction to decay heat and why it matters.",
    categoryId,
    tags: ["safety"],
    references: [{ citation: "A useful textbook, 2020." }],
    contentJson: { type: "doc", content: [] },
    contentHtml: LONG_HTML,
    declarations: { author: true, originality: true, confidentiality: true },
  };
}

export async function submitArticle(writer: Agent, categoryId: string, title?: string) {
  const created = await writer.post("/api/v1/writer/articles").send(validArticle(categoryId, title));
  if (created.status !== 201) throw new Error(`Create failed: ${created.text}`);
  const id: string = created.body.data.id;
  const submitted = await writer.post(`/api/v1/writer/articles/${id}/submit`).send({});
  if (submitted.status !== 200) throw new Error(`Submit failed: ${submitted.text}`);
  return id;
}
