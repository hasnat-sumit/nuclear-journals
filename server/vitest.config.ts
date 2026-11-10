import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Starting a real database in tests can take a while on first run.
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Fixed values so tests never depend on a developer's local .env file.
    env: {
      NODE_ENV: "test",
      CLIENT_ORIGINS: "http://localhost:3000",
      RATE_LIMIT_MAX: "5",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-only-secret-with-enough-length-1234",
      MONGODB_URI: "mongodb://127.0.0.1:1/unused",
      SMTP_URL: "",
      CLOUDINARY_URL: "",
      INTERNAL_API_KEY: "test-internal-key-with-enough-length-1234",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    },
  },
});
