import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { sendEmail } from "./email.js";

function createAuth() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Connect to the database before using auth");

  return betterAuth({
    appName: "Nuclear Journal",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    trustedOrigins: env.CLIENT_ORIGINS,
    // Better Auth skips its origin and redirect checks when NODE_ENV is "test".
    // Keep them on so tests exercise the same protection as production.
    advanced: { disableOriginCheck: false },
    database: mongodbAdapter(db, { client: mongoose.connection.getClient(), transaction: false }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your Nuclear Journal password",
          text: `Use this link to choose a new password:\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your Nuclear Journal email",
          text: `Welcome to Nuclear Journal. Confirm your email address here:\n\n${url}`,
        });
      },
    },
    // Google sign-in creates the account on first use, so the same button signs up and signs in.
    // Google's redirect URL is BETTER_AUTH_URL + /api/v1/auth/callback/google.
    // If someone already registered this email with a password, Better Auth links the
    // Google account only when that email was verified, so an unverified sign-up
    // can't be used to take over the real owner's Google login.
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              // Always show Google's account chooser, so a shared computer doesn't
              // silently sign in with whoever used Google last.
              prompt: "select_account",
            },
          }
        : {},
    user: {
      // `input: false` means no client can set these fields during sign-up,
      // so nobody can register themselves as an editor.
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "reader", input: false },
        isActive: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Created on first use because it needs an open database connection.
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
