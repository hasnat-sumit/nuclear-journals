import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCategory, signUp, startDatabase, stopDatabase, submitArticle, app } from "./helpers.js";
import { Article } from "../src/models/article.model.js";
import { User } from "../src/models/user.model.js";

const testApp = app();

beforeAll(startDatabase);
afterAll(stopDatabase);

const education = [
  { university: "University of Dhaka", subject: "Nuclear Engineering", passingYear: 2018 },
  { university: "KAIST", subject: "Reactor Physics", passingYear: 2021 },
];
const socialLinks = [
  { platform: "linkedin", url: "https://www.linkedin.com/in/example" },
  { platform: "orcid", url: "https://orcid.org/0000-0002-1825-0097" },
];

describe("extended profile", () => {
  it("lets a writer save several education entries and social links", async () => {
    const { agent } = await signUp(testApp, "writer");

    await agent.patch("/api/v1/me").send({ bio: "Engineer.", education, socialLinks }).expect(200);

    const me = (await agent.get("/api/v1/me").expect(200)).body.data;
    expect(me.education).toEqual(education);
    expect(me.socialLinks).toEqual(socialLinks);
    expect(me.bio).toBe("Engineer.");
  });

  it("keeps existing fields when only education changes", async () => {
    const { agent } = await signUp(testApp, "reviewer");
    await agent.patch("/api/v1/me").send({ bio: "Keep me", expertise: ["Safety"] }).expect(200);
    await agent.patch("/api/v1/me").send({ education: [education[0]] }).expect(200);

    const me = (await agent.get("/api/v1/me")).body.data;
    expect(me).toMatchObject({ bio: "Keep me", expertise: ["Safety"], education: [education[0]] });
  });

  it("refuses links that are not web addresses", async () => {
    const { agent } = await signUp(testApp, "editor");

    for (const url of ["javascript:alert(1)", "data:text/html,hi", "linkedin.com/in/x"]) {
      await agent.patch("/api/v1/me").send({ socialLinks: [{ platform: "website", url }] }).expect(400);
    }
    await agent.patch("/api/v1/me").send({ socialLinks: [{ platform: "myspace", url: "https://a.example" }] }).expect(400);
  });

  it("checks education values", async () => {
    const { agent } = await signUp(testApp, "writer");
    const tooLate = new Date().getFullYear() + 11;

    await agent.patch("/api/v1/me").send({ education: [{ ...education[0], passingYear: tooLate }] }).expect(400);
    await agent.patch("/api/v1/me").send({ education: [{ ...education[0], university: "" }] }).expect(400);
    await agent.patch("/api/v1/me").send({ education: Array(11).fill(education[0]) }).expect(400);
  });

  it("keeps the extended profile for contributors only", async () => {
    const { agent } = await signUp(testApp, "reader");

    await agent.patch("/api/v1/me").send({ education }).expect(403);
    await agent.patch("/api/v1/me").send({ socialLinks }).expect(403);
    await agent.patch("/api/v1/me").send({ bio: "Readers can still edit this." }).expect(200);
  });

  it("shows education and links on the public author page", async () => {
    const writer = await signUp(testApp, "writer");
    await writer.agent.patch("/api/v1/me").send({ education, socialLinks }).expect(200);

    const articleId = await submitArticle(writer.agent, await createCategory());
    await Article.updateOne({ _id: articleId }, { $set: { status: "published", publishedAt: new Date() } });

    const author = (await request(testApp).get(`/api/v1/authors/${writer.id}`).expect(200)).body.data;
    expect(author.education).toEqual(education);
    expect(author.socialLinks).toEqual(socialLinks);
    expect(author.email).toBeUndefined();
  });
});

describe("profile photo", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("is only for contributors", async () => {
    const { agent } = await signUp(testApp, "reader");
    await agent.post("/api/v1/me/photo").attach("image", png, "me.png").expect(403);
  });

  it("rejects files that are not images, whatever their name", async () => {
    const { agent } = await signUp(testApp, "writer");
    const res = await agent.post("/api/v1/me/photo").attach("image", Buffer.from("not an image"), "me.png");
    expect(res.status).toBe(400);
  });

  it("explains when uploads are not set up", async () => {
    const { agent } = await signUp(testApp, "reviewer");
    const res = await agent.post("/api/v1/me/photo").attach("image", png, "me.png");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("UPLOADS_UNAVAILABLE");
  });

  it("can be removed", async () => {
    const { agent } = await signUp(testApp, "editor");
    await agent.delete("/api/v1/me/photo").expect(200);
    expect((await agent.get("/api/v1/me")).body.data.image).toBeNull();
  });
});

describe("GET /api/v1/stats", () => {
  it("counts published articles, active writers and reviewers, and categories", async () => {
    const before = (await request(testApp).get("/api/v1/stats").expect(200)).body.data;

    const writer = await signUp(testApp, "writer");
    const inactive = await signUp(testApp, "reviewer");
    await signUp(testApp, "reader");
    await User.updateOne({ _id: inactive.id }, { $set: { isActive: false } });
    const articleId = await submitArticle(writer.agent, await createCategory());
    await Article.updateOne({ _id: articleId }, { $set: { status: "published", publishedAt: new Date() } });

    const after = (await request(testApp).get("/api/v1/stats").expect(200)).body.data;
    expect(after.publishedArticles - before.publishedArticles).toBe(1);
    expect(after.activeResearchers - before.activeResearchers).toBe(1);
    expect(after.researchAreas - before.researchAreas).toBe(1);
    expect(Object.keys(after).sort()).toEqual(["activeResearchers", "publishedArticles", "researchAreas"]);
  });
});
