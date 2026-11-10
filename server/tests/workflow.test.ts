import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Article } from "../src/models/article.model.js";
import { EditorialLog } from "../src/models/editorial-log.model.js";
import { ReviewAssignment } from "../src/models/review-assignment.model.js";
import { ReviewerProfile } from "../src/models/reviewer-profile.model.js";
import { User } from "../src/models/user.model.js";
import { rankReviewers, type ReviewerEvaluation } from "../src/services/assignments.js";
import { app, createCategory, makeReviewerAvailable, signUp, startDatabase, stopDatabase, submitArticle, validArticle, type Agent } from "./helpers.js";

const testApp = app();

beforeAll(startDatabase);
afterAll(stopDatabase);

describe("authentication", () => {
  it("does not let anyone register themselves as an editor", async () => {
    const res = await request(testApp)
      .post("/api/v1/auth/sign-up/email")
      .set("Origin", "http://localhost:3000")
      .send({ name: "Attacker", email: "attacker@example.com", password: "Correct-Horse-Battery-9", role: "editor" });
    const user = await User.findOne({ email: "attacker@example.com" }).lean();
    if (user) expect(user.role).toBe("reader");
    else expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("requires email verification before sign-in", async () => {
    const email = "unverified@example.com";
    const agent = request.agent(testApp);
    agent.set("Origin", "http://localhost:3000");
    await agent.post("/api/v1/auth/sign-up/email").send({ name: "New Person", email, password: "Correct-Horse-Battery-9" }).expect(200);
    const res = await agent.post("/api/v1/auth/sign-in/email").send({ email, password: "Correct-Horse-Battery-9" });
    expect(res.status).toBe(403);
  });

  it("blocks a deactivated account immediately", async () => {
    const { agent, id } = await signUp(testApp, "writer");
    await agent.get("/api/v1/me").expect(200);
    await User.updateOne({ _id: id }, { $set: { isActive: false } });
    await agent.get("/api/v1/me").expect(401);
  });
});

describe("role-based access", () => {
  const routes: [string, string][] = [
    ["get", "/api/v1/admin/overview"],
    ["get", "/api/v1/admin/articles"],
    ["get", "/api/v1/admin/applications"],
    ["get", "/api/v1/admin/logs"],
    ["get", "/api/v1/writer/articles"],
    ["get", "/api/v1/reviewer/assignments"],
    ["get", "/api/v1/me"],
  ];

  it.each(routes)("rejects anonymous %s %s", async (method, path) => {
    const res = await request(testApp)[method as "get"](path);
    expect(res.status).toBe(401);
  });

  it("keeps each role inside its own area", async () => {
    const reader = (await signUp(testApp, "reader")).agent;
    const writer = (await signUp(testApp, "writer")).agent;
    const reviewer = (await signUp(testApp, "reviewer")).agent;

    await reader.get("/api/v1/writer/articles").expect(403);
    await reader.get("/api/v1/reviewer/assignments").expect(403);
    await reader.get("/api/v1/admin/overview").expect(403);
    await writer.get("/api/v1/admin/overview").expect(403);
    await writer.get("/api/v1/reviewer/assignments").expect(403);
    await reviewer.get("/api/v1/admin/overview").expect(403);
    await reviewer.get("/api/v1/writer/articles").expect(403);
  });

  it("does not let one writer read or change another's article", async () => {
    const owner = (await signUp(testApp, "writer")).agent;
    const other = (await signUp(testApp, "writer")).agent;
    const category = await createCategory();
    const { body } = await owner.post("/api/v1/writer/articles").send(validArticle(category, "Owner Only"));
    await other.get(`/api/v1/writer/articles/${body.data.id}`).expect(404);
    await other.patch(`/api/v1/writer/articles/${body.data.id}`).send({ title: "Hijacked" }).expect(404);
    await other.post(`/api/v1/writer/articles/${body.data.id}/submit`).send({}).expect(404);
  });

  it("does not let a reviewer act on someone else's assignment", async () => {
    const editor = (await signUp(testApp, "editor")).agent;
    const writer = (await signUp(testApp, "writer")).agent;
    const invited = await signUp(testApp, "reviewer");
    const stranger = (await signUp(testApp, "reviewer")).agent;
    const category = await createCategory();
    await makeReviewerAvailable(invited.id, category);
    const articleId = await submitArticle(writer, category);
    await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "manual", reviewerIds: [invited.id] }).expect(201);
    const assignment = await ReviewAssignment.findOne({ article: articleId }).lean();
    await stranger.get(`/api/v1/reviewer/assignments/${String(assignment!._id)}`).expect(404);
    await stranger.post(`/api/v1/reviewer/assignments/${String(assignment!._id)}/accept`).send({}).expect(404);
  });
});

describe("applications", () => {
  it("promotes a reader only after an editor approves", async () => {
    const applicant = await signUp(testApp, "reader");
    const editor = (await signUp(testApp, "editor")).agent;
    const statement = "I am a nuclear engineer with ten years of experience in plant safety analysis.";

    await applicant.agent.post("/api/v1/me/applications/reviewer").send({ statement }).expect(201);
    await applicant.agent.post("/api/v1/me/applications/writer").send({ statement }).expect(409);
    expect((await User.findById(applicant.id).lean())?.role).toBe("reader");

    await editor.post(`/api/v1/admin/applications/${applicant.id}/reviewer/approve`).send({}).expect(200);
    expect((await User.findById(applicant.id).lean())?.role).toBe("reviewer");

    // New reviewers stay unavailable until they opt in.
    const profile = await ReviewerProfile.findOne({ user: applicant.id }).lean();
    expect(profile?.availability).toBe("unavailable");
  });

  it("never demotes someone who became an editor while their application was pending", async () => {
    const applicant = await signUp(testApp, "reader");
    const editor = (await signUp(testApp, "editor")).agent;
    const statement = "I am a nuclear engineer with ten years of experience in plant safety analysis.";

    await applicant.agent.post("/api/v1/me/applications/reviewer").send({ statement }).expect(201);
    await User.updateOne({ _id: applicant.id }, { $set: { role: "editor" } });

    await editor.post(`/api/v1/admin/applications/${applicant.id}/reviewer/approve`).send({}).expect(404);
    expect((await User.findById(applicant.id).lean())?.role).toBe("editor");
  });
});

describe("article lifecycle", () => {
  let editor: Agent;
  let writer: Agent;
  let category: string;

  beforeAll(async () => {
    editor = (await signUp(testApp, "editor")).agent;
    writer = (await signUp(testApp, "writer")).agent;
    category = await createCategory();
  });

  it("removes dangerous HTML before storing it", async () => {
    const { body } = await writer.post("/api/v1/writer/articles").send({
      ...validArticle(category, "XSS Attempt"),
      contentHtml: `<p onclick="alert(1)">Safe</p><script>alert(2)</script><a href="javascript:alert(3)">x</a><img src="https://evil.example/a.png" onerror="alert(4)">`,
    });
    const html: string = body.data.contentHtml;
    expect(html).toContain("Safe");
    for (const banned of ["script", "onclick", "javascript:", "onerror", "evil.example"]) {
      expect(html).not.toContain(banned);
    }
  });

  it("refuses incomplete submissions, including missing declarations", async () => {
    const { body } = await writer.post("/api/v1/writer/articles").send({ title: "Barely Started" });
    const res = await writer.post(`/api/v1/writer/articles/${body.data.id}/submit`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.details).toContain("Confirm all three declarations.");
  });

  it("rejects duplicate custom slugs and generates unique ones", async () => {
    const first = await writer.post("/api/v1/writer/articles").send({ title: "Same Title" });
    const second = await writer.post("/api/v1/writer/articles").send({ title: "Same Title" });
    expect(first.body.data.slug).toBe("same-title");
    expect(second.body.data.slug).toBe("same-title-2");
    await writer.post("/api/v1/writer/articles").send({ title: "Other", slug: "same-title" }).expect(409);
  });

  it("runs the full path from draft to published and records an audit trail", async () => {
    const id = await submitArticle(writer, category, "Full Path Article");

    // Writers cannot edit once submitted, and cannot publish at any point.
    await writer.patch(`/api/v1/writer/articles/${id}`).send({ title: "Sneaky Change" }).expect(409);
    await writer.post(`/api/v1/admin/articles/${id}/publish`).send({}).expect(403);

    await editor.post(`/api/v1/admin/articles/${id}/start-screening`).send({}).expect(200);
    await editor.post(`/api/v1/admin/articles/${id}/publish`).send({}).expect(409);

    await editor.post(`/api/v1/admin/articles/${id}/request-revision`).send({ feedback: "Add a reference list." }).expect(200);
    expect((await writer.get(`/api/v1/writer/articles/${id}`)).body.data.status).toBe("revision_requested");

    await writer.patch(`/api/v1/writer/articles/${id}`).send({ title: "Full Path Article, Revised" }).expect(200);
    await writer.post(`/api/v1/writer/articles/${id}/resubmit`).send({ changeSummary: "Added references." }).expect(200);
    expect((await Article.findById(id).lean())?.reviewRound).toBe(2);

    const { body: revisions } = await writer.get(`/api/v1/writer/articles/${id}/revisions`);
    expect(revisions.data.map((row: { version: number }) => row.version)).toEqual([2, 1]);

    await editor.post(`/api/v1/admin/articles/${id}/approve`).send({}).expect(200);
    expect((await request(testApp).get(`/api/v1/articles/${(await Article.findById(id).lean())!.slug}`)).status).toBe(404);

    await editor.post(`/api/v1/admin/articles/${id}/publish`).send({}).expect(200);
    const article = await Article.findById(id).lean();
    await request(testApp).get(`/api/v1/articles/${article!.slug}`).expect(200);

    await editor.post(`/api/v1/admin/articles/${id}/unpublish`).send({}).expect(200);
    await request(testApp).get(`/api/v1/articles/${article!.slug}`).expect(404);

    const actions = (await EditorialLog.find({ article: id }).sort({ createdAt: 1 }).lean()).map((log) => log.action);
    expect(actions).toEqual(["submit", "start_screening", "request_revision", "resubmit", "approve", "publish", "unpublish"]);
  });
});

describe("reviewer assignment rules", () => {
  it("ranks by proficiency, then workload, then fairness, deterministically", () => {
    const base: ReviewerEvaluation = {
      reviewerId: "a", name: "", email: "", proficiency: "advanced", workload: 0,
      maxPendingReviews: 3, totalAssignments: 0, eligible: true, reasons: [], blocked: false,
    };
    const ranked = rankReviewers([
      { ...base, reviewerId: "tieB" },
      { ...base, reviewerId: "tieA" },
      { ...base, reviewerId: "busy", workload: 2 },
      { ...base, reviewerId: "experienced", totalAssignments: 5 },
      { ...base, reviewerId: "intermediate", proficiency: "intermediate" },
      { ...base, reviewerId: "expert", proficiency: "expert", workload: 2 },
    ]);
    expect(ranked.map((item) => item.reviewerId)).toEqual(["expert", "tieA", "tieB", "experienced", "busy", "intermediate"]);
  });

  describe("eligibility", () => {
    let editor: Agent;
    let writer: Agent;
    let category: string;
    let articleId: string;

    beforeAll(async () => {
      editor = (await signUp(testApp, "editor")).agent;
      const writerUser = await signUp(testApp, "writer");
      writer = writerUser.agent;
      category = await createCategory("Unique Topic");
      articleId = await submitArticle(writer, category, "Eligibility Article");
    });

    it("never forces an assignment and keeps the article queued", async () => {
      const res = await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "automatic" });
      expect(res.status).toBe(200);
      expect(res.body.data.assigned).toEqual([]);
      expect((await Article.findById(articleId).lean())?.status).toBe("submitted");
      expect(await ReviewAssignment.countDocuments({ article: articleId })).toBe(0);
    });

    it("skips unavailable, excluded and full reviewers", async () => {
      const unavailable = await signUp(testApp, "reviewer");
      await makeReviewerAvailable(unavailable.id, category);
      await ReviewerProfile.updateOne({ user: unavailable.id }, { $set: { availability: "unavailable" } });

      const excluded = await signUp(testApp, "reviewer");
      await makeReviewerAvailable(excluded.id, category);
      await ReviewerProfile.updateOne({ user: excluded.id }, { $set: { excludedTopics: [category] } });

      const full = await signUp(testApp, "reviewer");
      await makeReviewerAvailable(full.id, category);
      await ReviewerProfile.updateOne({ user: full.id }, { $set: { maxPendingReviews: 1 } });
      const other = await submitArticle(writer, category, "Fills Capacity");
      await editor.post(`/api/v1/admin/articles/${other}/assign-reviewers`).send({ mode: "manual", reviewerIds: [full.id] }).expect(201);

      const { body } = await editor.get(`/api/v1/admin/articles/${articleId}/eligible-reviewers`);
      const reasonsFor = (id: string) => body.data.find((row: { reviewerId: string }) => row.reviewerId === id).reasons;
      expect(reasonsFor(unavailable.id)).toContain("Reviewer is unavailable");
      expect(reasonsFor(excluded.id)).toContain("Reviewer excluded this topic");
      expect(reasonsFor(full.id)).toContain("Reviewer is at workload capacity");

      const res = await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "automatic" });
      expect(res.body.data.assigned).toEqual([]);
    });

    it("requires a recorded reason to override the rules, and logs it", async () => {
      const unavailable = await signUp(testApp, "reviewer");
      await ReviewerProfile.updateOne({ user: unavailable.id }, { $set: { availability: "unavailable" } }, { upsert: true, setDefaultsOnInsert: true });

      const refused = await editor.post(`/api/v1/admin/articles/${articleId}/assign-reviewers`).send({ mode: "manual", reviewerIds: [unavailable.id] });
      expect(refused.status).toBe(422);
      expect(refused.body.error.code).toBe("OVERRIDE_REQUIRED");

      await editor
        .post(`/api/v1/admin/articles/${articleId}/assign-reviewers`)
        .send({ mode: "manual", reviewerIds: [unavailable.id], overrideReason: "Only specialist available for this topic." })
        .expect(201);

      const assignment = await ReviewAssignment.findOne({ article: articleId, reviewer: unavailable.id }).lean();
      expect(assignment?.overrideReason).toBe("Only specialist available for this topic.");
      expect(await EditorialLog.exists({ article: articleId, action: "assign_reviewer_override" })).toBeTruthy();
    });

    it("cannot assign an author to review their own article, even with an override", async () => {
      const author = await signUp(testApp, "writer");
      await ReviewerProfile.create({ user: author.id });
      await User.updateOne({ _id: author.id }, { $set: { role: "reviewer" } });
      const article = await Article.create({ title: "Self Review", slug: "self-review", author: author.id, category, status: "submitted" });
      const res = await editor
        .post(`/api/v1/admin/articles/${String(article._id)}/assign-reviewers`)
        .send({ mode: "manual", reviewerIds: [author.id], overrideReason: "Trying anyway for this test." });
      expect(res.status).toBe(409);
    });
  });
});

describe("engagement safeguards", () => {
  let writer: Awaited<ReturnType<typeof signUp>>;
  let editor: Agent;
  let reader: Agent;
  let articleId: string;
  let slug: string;

  beforeAll(async () => {
    writer = await signUp(testApp, "writer");
    editor = (await signUp(testApp, "editor")).agent;
    reader = (await signUp(testApp, "reader")).agent;
    articleId = await submitArticle(writer.agent, await createCategory(), "Engagement Article");
    await editor.post(`/api/v1/admin/articles/${articleId}/approve`).send({}).expect(200);
    await editor.post(`/api/v1/admin/articles/${articleId}/publish`).send({}).expect(200);
    slug = (await Article.findById(articleId).lean())!.slug;
  });

  it("holds comments for moderation", async () => {
    await request(testApp).post(`/api/v1/articles/${slug}/comments`).send({ content: "Anonymous" }).expect(401);
    await reader.post(`/api/v1/articles/${slug}/comments`).send({ content: "A useful explanation, thank you." }).expect(201);

    const before = await request(testApp).get(`/api/v1/articles/${slug}/comments`);
    expect(before.body.data).toEqual([]);

    const { body } = await editor.get("/api/v1/admin/comments");
    await editor.patch(`/api/v1/admin/comments/${String(body.data[0]._id)}`).send({ status: "approved" }).expect(200);

    const after = await request(testApp).get(`/api/v1/articles/${slug}/comments`);
    expect(after.body.data[0].content).toBe("A useful explanation, thank you.");
    expect(JSON.stringify(after.body)).not.toContain("@example.com");
  });

  it("prevents self-rating and duplicate ratings", async () => {
    await writer.agent.post("/api/v1/ratings").send({ targetType: "article", targetId: articleId, score: 5 }).expect(403);
    await writer.agent.post("/api/v1/ratings").send({ targetType: "writer", targetId: writer.id, score: 5 }).expect(403);

    await reader.post("/api/v1/ratings").send({ targetType: "article", targetId: articleId, score: 2 }).expect(200);
    const second = await reader.post("/api/v1/ratings").send({ targetType: "article", targetId: articleId, score: 4 }).expect(200);
    expect(second.body.data.summary).toEqual({ average: 4, count: 1 });
  });

  it("does not let ratings influence reviewer assignment", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile("src/services/assignments.ts", "utf8"));
    expect(source.toLowerCase()).not.toContain("rating");
  });

  it("supports bookmarks, and never bookmarks unpublished work", async () => {
    await reader.put(`/api/v1/me/bookmarks/${articleId}`).send({}).expect(200);
    await reader.put(`/api/v1/me/bookmarks/${articleId}`).send({}).expect(200);
    const { body } = await reader.get("/api/v1/me/bookmarks");
    expect(body.data).toHaveLength(1);

    const draft = await writer.agent.post("/api/v1/writer/articles").send({ title: "Private Draft" });
    await reader.put(`/api/v1/me/bookmarks/${draft.body.data.id}`).send({}).expect(404);
  });

  it("never exposes author email or drafts on public routes", async () => {
    const { body: list } = await request(testApp).get("/api/v1/articles");
    expect(JSON.stringify(list)).not.toContain("@example.com");
    expect(list.data.every((item: { title: string }) => item.title !== "Private Draft")).toBe(true);
    const { body: author } = await request(testApp).get(`/api/v1/authors/${writer.id}`);
    expect(author.data).not.toHaveProperty("email");
    expect(author.data).not.toHaveProperty("role");
  });

  it("finds published articles by search", async () => {
    const { body } = await request(testApp).get("/api/v1/search?q=engagement");
    expect(body.data.map((item: { slug: string }) => item.slug)).toContain(slug);
  });
});

describe("review acceptance and draft updates", () => {
  it("requires acceptance of overdue invitations and lets a draft recommendation be cleared", async () => {
    const writer = await signUp(testApp, "writer");
    const reviewer = await signUp(testApp, "reviewer");
    const editor = await signUp(testApp, "editor");
    const category = await createCategory();
    const articleId = await submitArticle(writer.agent, category, "Overdue Invitation Regression");
    const assignment = await ReviewAssignment.create({
      article: articleId, reviewer: reviewer.id, assignedBy: editor.id,
      assignmentType: "manual", reviewRound: 1, status: "invited",
      dueDate: new Date(Date.now() - 60_000),
    });
    await reviewer.agent.get("/api/v1/reviewer/assignments").expect(200);
    const path = `/api/v1/reviewer/assignments/${String(assignment._id)}`;
    const review = {
      recommendation: "accept",
      criteria: { technicalAccuracy: 5, clarity: 5, relevance: 5, references: 5, overall: 5 },
      comments: "A detailed assessment of the technical content and supporting references.",
    };
    await reviewer.agent.put(`${path}/review`).send(review).expect(409);
    await reviewer.agent.post(`${path}/review`).send(review).expect(409);
    await reviewer.agent.post(`${path}/accept`).send({}).expect(200);
    await reviewer.agent.put(`${path}/review`).send(review).expect(200);
    await reviewer.agent.put(`${path}/review`).send({ recommendation: null }).expect(200);
    const cleared = await reviewer.agent.get(path).expect(200);
    expect(cleared.body.data.review.recommendation).toBeNull();
    await reviewer.agent.put(`${path}/review`).send({ recommendation: "accept" }).expect(200);
    await reviewer.agent.put(`${path}/review`).send({ comments: "Updated draft comments." }).expect(200);
    const retained = await reviewer.agent.get(path).expect(200);
    expect(retained.body.data.review.recommendation).toBe("accept");
    await reviewer.agent.post(`${path}/review`).send(review).expect(200);
  });
});
