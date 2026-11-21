import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import type { Role } from "../constants.js";
import { getAuth } from "../lib/auth.js";
import { AppError } from "../lib/http.js";
import { User } from "../models/user.model.js";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: CurrentUser;
  }
}

// Reads role and active status from the database on every request, so a role change
// or deactivation takes effect immediately rather than when the session expires.
async function loadCurrentUser(req: Request): Promise<CurrentUser | null> {
  const session = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const user = await User.findById(session.user.id).select("name email role isActive").lean();
  if (!user || user.isActive === false) return null;
  return { id: String(user._id), name: user.name, email: user.email, role: user.role as Role };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await loadCurrentUser(req);
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  req.currentUser = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => undefined);
    if (!roles.includes(req.currentUser!.role)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to do this.");
    }
    next();
  };
}

export function currentUser(req: Request): CurrentUser {
  if (!req.currentUser) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return req.currentUser;
}
