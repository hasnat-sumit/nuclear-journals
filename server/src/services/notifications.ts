import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { sendEmail } from "../lib/email.js";
import { Notification } from "../models/engagement.models.js";
import { User } from "../models/user.model.js";

type Id = Types.ObjectId | string;

// CONFIDENTIALITY: callers must never notify a writer about reviewer activity.
// Writers are only notified about official editorial decisions.
export async function notify(userId: Id, message: string, link?: string) {
  await Notification.create({ user: userId, message, link });

  const user = await User.findById(userId).select("email").lean();
  if (!user) return;
  // A failed email must not undo an editorial action that has already happened.
  try {
    const siteLink = link ? `\n\nOpen Nuclear Journal: ${env.BETTER_AUTH_URL}${link}` : "";
    await sendEmail({ to: user.email, subject: "Nuclear Journal update", text: `${message}${siteLink}` });
  } catch (error) {
    console.error("Notification email failed:", error instanceof Error ? error.message : "unknown");
  }
}

export async function notifyEditors(message: string, link?: string) {
  const editors = await User.find({ role: "editor", isActive: true }).select("_id").lean();
  await Promise.all(editors.map((editor) => notify(editor._id, message, link)));
}
