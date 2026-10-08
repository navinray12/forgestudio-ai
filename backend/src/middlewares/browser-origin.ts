import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME, AUTH_CHALLENGE_COOKIE, browserOrigin } from "../config/auth.js";
import { AppError } from "../utils/app-error.js";

/** Cookie authority is accepted only from the configured management origin.
 * Bearer-only machine requests have a different authentication contract.
 */
export function isAllowedBrowserOrigin(originHeader?: string): boolean {
  if (!originHeader) return false;
  try {
    const configured = browserOrigin();
    if (originHeader === configured) return true;
  } catch {}
  if (process.env.NODE_ENV !== "production") {
    if (originHeader === "http://localhost:5173" || originHeader === "http://127.0.0.1:5173") {
      return true;
    }
  }
  return false;
}

export function requireBrowserOrigin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!isAllowedBrowserOrigin(req.headers.origin)) throw new AppError("The request origin is not allowed.", 403, "ORIGIN_REJECTED");
    next();
  } catch (error) { next(error); }
}
export function protectCookieMutations(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const cookies = req.cookies;
  if (cookies?.[AUTH_COOKIE_NAME] || cookies?.[AUTH_CHALLENGE_COOKIE] || cookies?.forge_session) {
    return requireBrowserOrigin(req, res, next);
  }
  next();
}
