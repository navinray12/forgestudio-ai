import type { Request, Response, NextFunction } from "express";
import { requireRecentMfa } from "../modules/identity/domain/assurance.js";
export function requirePrivilegedMutation(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production" || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  try { requireRecentMfa(res.locals.session); next(); } catch (error) { next(error); }
}
