import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hasImageSignature } from "../src/routes/upload.routes.js";

const ALLOWED_ORIGIN = "http://localhost:3000";

describe("GET /api/v1/health", () => {
  it("reports that the API is alive", async () => {
    const res = await request(createApp()).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "nuclear-journal-api" });
    expect(Date.parse(res.body.timestamp)).not.toBeNaN();
  });

  it("exposes only the documented fields", async () => {
    const res = await request(createApp()).get("/api/v1/health");

    expect(Object.keys(res.body).sort()).toEqual(["service", "status", "timestamp"]);
  });

  it("is not rate limited, so uptime checks keep working", async () => {
    const app = createApp();

    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
    }
  });
});

describe("security headers", () => {
  it("sets helmet headers and hides the framework", async () => {
    const res = await request(createApp()).get("/api/v1/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const res = await request(createApp()).get("/api/v1/health").set("Origin", ALLOWED_ORIGIN);

    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not grant access to other origins", async () => {
    const res = await request(createApp())
      .get("/api/v1/health")
      .set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("error handling", () => {
  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(createApp()).get("/api/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed JSON without echoing the body back", async () => {
    const res = await request(createApp())
      .post("/api/v1/does-not-exist")
      .set("Content-Type", "application/json")
      .send('{"secret": "do-not-echo"');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.text).not.toContain("do-not-echo");
  });
});

describe("rate limiting", () => {
  it("returns a JSON 429 once the limit is exceeded", async () => {
    const app = createApp();

    // RATE_LIMIT_MAX is 5 in vitest.config.ts.
    for (let i = 0; i < 5; i += 1) {
      await request(app).get("/api/v1/does-not-exist");
    }
    const res = await request(app).get("/api/v1/does-not-exist");

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("internal requests", () => {
  it("exempts the website server from the rate limit, but only with the right key", async () => {
    const app = createApp();

    for (let i = 0; i < 8; i += 1) {
      const res = await request(app)
        .get("/api/v1/does-not-exist")
        .set("x-internal-api-key", "test-internal-key-with-enough-length-1234");
      expect(res.status).toBe(404);
    }
    for (let i = 0; i < 5; i += 1) {
      await request(app).get("/api/v1/does-not-exist").set("x-internal-api-key", "wrong");
    }
    const res = await request(app).get("/api/v1/does-not-exist").set("x-internal-api-key", "wrong");
    expect(res.status).toBe(429);
  });
});

describe("request origin protection", () => {
  it("refuses state-changing requests from other websites", async () => {
    const res = await request(createApp())
      .post("/api/v1/does-not-exist")
      .set("Origin", "https://evil.example")
      .send({});

    expect(res.status).toBe(403);
  });
});

describe("image upload checks", () => {
  it("recognises real images by their bytes, not their name", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const webp = Buffer.from("RIFF0000WEBP", "latin1");

    expect(hasImageSignature(png)).toBe(true);
    expect(hasImageSignature(jpeg)).toBe(true);
    expect(hasImageSignature(webp)).toBe(true);
    expect(hasImageSignature(Buffer.from("<svg onload=alert(1)>"))).toBe(false);
  });
});
