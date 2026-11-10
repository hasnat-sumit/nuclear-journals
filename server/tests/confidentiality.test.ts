import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Article } from "../src/models/article.model.js";
import { app, createCategory, makeReviewerAvailable, signUp, startDatabase, stopDatabase, submitArticle, type Agent } from "./helpers.js";

// These words must never appear in anything sent to a writer.
const FORBIDDEN = ["reviewer", "assignment", "declin", "invit", "under_review", "editorial_screening", "overrideReason"];

function expectNoLeak(body: unknown, secrets: string[] = []) {
  const text = JSON.stringify(body).toLowerCase();
  for (const word of [...FORBIDDEN, ...secrets]) {
    expect(text).not.toContain(word.toLowerCase());
  }
}

async function everythingWriterCanRead(writer: Agent, articleId: string) {
  const responses = await Promise.all([
    writer.get("/api/v1/writer/articles"),
    writer.get(`/api/v1/writer/articles/${articleId}`),
    writer.get(`/api/v1/writer/articles/${articleId}/feedback`),
    writer.get(`/api/v1/writer/articles/${articleId}/revisions`),
    writer.get("/api/v1/me/notifications"),
    writer.get("/api/v1/writer/stats"),
  ]);
  for (const response of responses) expect(response.status).toBe(200);
  return responses.map((response) => response.body);
}

describe("writer confidentiality", () => {
  const testApp = app();
  let editor: Agent;
  let writer: Agent;
  let reviewer: Agent;
  let reviewerId: string;
  let reviewerEmail: string;
  let category: string;

  beforeAll(async () => {
    await startDatabase();
    editor = (await signUp(testApp, "editor")).agent;
    writer = (await signUp(testApp, "writer")).agent;
    const reviewerUser = await signUp(testApp, "reviewer", "Secret Reviewer Name");
    reviewer = reviewerUser.agent;
    reviewerId = reviewerUser.id;
    reviewerEmail = reviewerUser.email;
    category = await createCategory();
    await makeReviewerAvailable(reviewerId, category);
  });

  afterAll(stopDatabase);

  it("keeps a writer's view identical through assignment, decline and reassignment", async () => {
    const articleId = await submitArticle(writer, category, "Case One Article");
    const statusNow = async () => (await writer.get(`/api/v1/writer/articles/${articleId}`)).body.data;

    const before = await statusNow();
    expect(before.status).toBe("pending_review");
    const statsNow = async () => (await writer.get("/api/v1/writer/stats")).body;
    const statsBefore = await statsNow();
    expect(statsBefore.data.pending_review).toBeGreaterThan(0);

    await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "automatic" }).expect(201);
    const afterAssign = await statusNow();

    const { body: list } = await reviewer.get("/api/v1/reviewer/assignments");
    const assignment = list.data.find((item: { articleTitle: string }) => item.articleTitle === "Case One Article");
    await reviewer
      .post(`/api/v1/reviewer/assignments/${assignment.id}/decline`)
      .send({ reason: "Secret decline reason text" })
      .expect(200);
    const afterDecline = await statusNow();

    // Byte-for-byte identical: not even a timestamp reveals that anything happened.
    expect(afterAssign).toEqual(before);
    expect(afterDecline).toEqual(before);
    expect(await statsNow()).toEqual(statsBefore);

    const internal = await Article.findById(articleId).lean();
    expect(internal?.status).toBe("editorial_screening");

    const everything = await everythingWriterCanRead(writer, articleId);
    expectNoLeak(everything, ["Secret decline reason text", "Secret Reviewer Name", reviewerEmail, reviewerId]);
  });

  it("releases only the editor's chosen feedback, never the review itself", async () => {
    const articleId = await submitArticle(writer, category, "Case Two Article");
    await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "automatic" }).expect(201);

    const { body: list } = await reviewer.get("/api/v1/reviewer/assignments");
    const assignment = list.data.find((item: { articleTitle: string }) => item.articleTitle === "Case Two Article");
    await reviewer.post(`/api/v1/reviewer/assignments/${assignment.id}/accept`).send({}).expect(200);

    const privateComment = "PRIVATE reviewer commentary that must stay inside the editorial team.";
    await reviewer
      .post(`/api/v1/reviewer/assignments/${assignment.id}/review`)
      .send({
        recommendation: "reject",
        criteria: { technicalAccuracy: 1, clarity: 2, relevance: 3, references: 4, overall: 2 },
        comments: privateComment,
      })
      .expect(200);

    const during = await everythingWriterCanRead(writer, articleId);
    expectNoLeak(during, [privateComment]);
    expect((await writer.get(`/api/v1/writer/articles/${articleId}`)).body.data.status).toBe("pending_review");

    await editor
      .post(`/api/v1/admin/articles/${articleId}/request-revision`)
      .send({ feedback: "Please expand the second section." })
      .expect(200);

    const { body: feedback } = await writer.get(`/api/v1/writer/articles/${articleId}/feedback`);
    expect(feedback.data).toHaveLength(1);
    expect(feedback.data[0].message).toBe("Please expand the second section.");
    expect(Object.keys(feedback.data[0]).sort()).toEqual(["createdAt", "decision", "id", "message"]);

    const after = await everythingWriterCanRead(writer, articleId);
    expectNoLeak(after, [privateComment]);
  });

  it("exposes no writer-visible field beyond the allowed list", async () => {
    const articleId = await submitArticle(writer, category, "Field Allowlist Article");
    const { body } = await writer.get(`/api/v1/writer/articles/${articleId}`);
    expect(body.data).not.toHaveProperty("updatedAt");
    expect(body.data).not.toHaveProperty("reviewRound");
    expect(body.data).not.toHaveProperty("author");
  });

  it("does not reveal the author to reviewers", async () => {
    const articleId = await submitArticle(writer, category, "Author Hidden Article");
    await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "automatic" }).expect(201);
    const { body: list } = await reviewer.get("/api/v1/reviewer/assignments");
    const assignment = list.data.find((item: { articleTitle: string }) => item.articleTitle === "Author Hidden Article");
    const { body } = await reviewer.get(`/api/v1/reviewer/assignments/${assignment.id}`);
    expect(body.data.article).not.toHaveProperty("author");
    expect(body.data.article.contentHtml).toContain("Reliable nuclear knowledge");
  });

  it("gives the editor the internal detail the writer cannot see", async () => {
    const { body: list } = await editor.get("/api/v1/admin/assignments?status=declined");
    expect(list.data[0].declineReason).toBe("Secret decline reason text");
    expect(list.data[0].reviewer.name).toBe("Secret Reviewer Name");
  });

  it("does not expose a reviewer through the public site without recognition", async () => {
    const articleId = await submitArticle(writer, category, "Public Credit Article");
    await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "automatic" }).expect(201);
    const { body: list } = await reviewer.get("/api/v1/reviewer/assignments");
    const assignment = list.data.find((item: { articleTitle: string }) => item.articleTitle === "Public Credit Article");
    await reviewer.post(`/api/v1/reviewer/assignments/${assignment.id}/accept`).send({}).expect(200);
    await reviewer
      .post(`/api/v1/reviewer/assignments/${assignment.id}/review`)
      .send({
        recommendation: "accept",
        criteria: { technicalAccuracy: 5, clarity: 5, relevance: 5, references: 5, overall: 5 },
        comments: "A well-argued article that is ready for readers, with clear explanations throughout.",
      })
      .expect(200);
    await editor.post(`/api/v1/admin/articles/${articleId}/approve`).send({}).expect(200);
    await editor.post(`/api/v1/admin/articles/${articleId}/publish`).send({}).expect(200);

    const slug = (await Article.findById(articleId).lean())!.slug;
    const hidden = await writer.get(`/api/v1/articles/${slug}`);
    expect(hidden.body.data.reviewers).toEqual([]);
    await writer.get(`/api/v1/reviewers/${reviewerId}`).expect(404);

    await reviewer.patch("/api/v1/reviewer/profile").send({ publicRecognition: true }).expect(200);
    const credited = await writer.get(`/api/v1/articles/${slug}`);
    expect(credited.body.data.reviewers).toEqual([{ id: reviewerId, name: "Secret Reviewer Name" }]);
  });
});
