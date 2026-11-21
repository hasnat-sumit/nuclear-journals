import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

// Tests read this list instead of sending anything.
export const testOutbox: Email[] = [];

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

export async function sendEmail(email: Email) {
  if (env.NODE_ENV === "test") {
    testOutbox.push(email);
    return;
  }
  if (!transport) {
    // Env validation requires SMTP in production, so this is development only.
    console.log(`\n[email] To: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
    return;
  }
  await transport.sendMail({ from: env.EMAIL_FROM, ...email });
}
