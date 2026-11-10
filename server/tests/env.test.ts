import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config/env.js";

describe("environment validation", () => {
  it("accepts several comma-separated origins and applies defaults", () => {
    const env = envSchema.parse({
      CLIENT_ORIGINS: "http://localhost:3000, https://nuclear-journal.example",
    });

    expect(env.CLIENT_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://nuclear-journal.example",
    ]);
    expect(env.PORT).toBe(4000);
  });

  it.each(["https://site.example/", "https://site.example/path", "not-a-url/"])(
    "rejects %s without throwing or repeating the value",
    (origin) => {
      const result = envSchema.safeParse({ CLIENT_ORIGINS: origin });

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).not.toContain(origin);
    },
  );

  it("refuses development defaults in production", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      CLIENT_ORIGINS: "https://site.example",
      INTERNAL_API_KEY: "local-development-internal-key-do-not-deploy",
    });

    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["BETTER_AUTH_SECRET", "MONGODB_URI", "INTERNAL_API_KEY", "SMTP_URL"]),
    );
  });

  it("accepts a complete production configuration", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      CLIENT_ORIGINS: "https://site.example",
      MONGODB_URI: "mongodb+srv://cluster.example/nuclear-journal",
      BETTER_AUTH_SECRET: "a-private-secret-that-is-long-enough-1234",
      BETTER_AUTH_URL: "https://site.example",
      INTERNAL_API_KEY: "another-private-value-that-is-long-enough",
      SMTP_URL: "smtps://user:pass@smtp.example.com:465",
    });

    expect(result.success).toBe(true);
  });

  it("needs both Google values or neither", () => {
    const base = { CLIENT_ORIGINS: "http://localhost:3000" };

    expect(envSchema.parse({ ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }).GOOGLE_CLIENT_ID).toBeUndefined();
    expect(envSchema.safeParse({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }).success).toBe(true);

    const halfSet = envSchema.safeParse({ ...base, GOOGLE_CLIENT_ID: "id" });
    expect(halfSet.success).toBe(false);
    expect(halfSet.error?.issues.map((issue) => issue.path.join("."))).toEqual(["GOOGLE_CLIENT_SECRET"]);
  });

  it("requires CLIENT_ORIGINS", () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });
});
