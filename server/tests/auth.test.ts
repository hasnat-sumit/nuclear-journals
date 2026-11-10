import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORIGIN, app, signUp, startDatabase, stopDatabase } from "./helpers.js";

beforeAll(startDatabase);
afterAll(stopDatabase);

describe("email sessions", () => {
  it("signs in, reports the session, and signs out", async () => {
    const testApp = app();
    const { agent, email } = await signUp(testApp);

    const session = await agent.get("/api/v1/auth/get-session");
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ email, role: "reader" });

    const signedOut = await agent.post("/api/v1/auth/sign-out").send({});
    expect(signedOut.status).toBe(200);

    const after = await agent.get("/api/v1/auth/get-session");
    expect(after.body).toBeNull();
    expect((await agent.get("/api/v1/me")).status).toBe(401);
  });
});

describe("Google sign-in", () => {
  it("sends the browser to Google with this site's callback address", async () => {
    const res = await request(app())
      .post("/api/v1/auth/sign-in/social")
      .set("Origin", ORIGIN)
      .send({ provider: "google", callbackURL: "/dashboard" });

    expect(res.status).toBe(200);
    const url = new URL(res.body.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/v1/auth/callback/google`);
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("refuses to redirect to another website after sign-in", async () => {
    const res = await request(app())
      .post("/api/v1/auth/sign-in/social")
      .set("Origin", ORIGIN)
      .send({ provider: "google", callbackURL: "https://evil.example/steal" });

    expect(res.status).toBe(403);
  });
});
