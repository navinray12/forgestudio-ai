import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME } from "../config/auth.js";
import { authenticateSession } from "../services/session-authentication.js";
import { authenticatePlatformSession, PLATFORM_COOKIE_NAME } from "../services/platform-session-authentication.js";
import { requireRecentMfa } from "../modules/identity/domain/assurance.js";
import { AppError } from "../utils/app-error.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token: unknown = req.cookies?.[AUTH_COOKIE_NAME];
    if (req.headers.authorization !== undefined) {
      if (!req.headers.authorization.startsWith("Bearer ")) throw new AppError("Invalid authorization scheme", 401, "UNAUTHORIZED");
      token = req.headers.authorization.substring(7).trim();
    }
    const session = await authenticateSession(token);
    if (!session) return res.status(401).json({ success: false, message: "Invalid or expired session" });
    res.locals.user = session.user;
    res.locals.session = session;
    (req as Request & { user?: typeof session.user }).user = session.user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message, error: { code: error.code } });
    }
    next(error);
  }
}

export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: Request, res: Response, next: NextFunction) => {
    // Passport and legacy middleware also attach a verified server-side req.user.
    const user = res.locals.user || (req as Request & { user?: { role: string } }).user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have access to this resource." },
      });
    }
    if (process.env.NODE_ENV === "production") {
      try { requireRecentMfa(res.locals.session, true); }
      catch (error) { return next(error); }
    }
    next();
  };
}


export async function requirePlatformAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[PLATFORM_COOKIE_NAME];
    const session = await authenticatePlatformSession(token);
    if (!session) return res.status(401).json({ success: false, error: { code: "PLATFORM_AUTH_REQUIRED", message: "Platform authentication is required." } });
    res.locals.user = session.user;
    res.locals.session = session;
    (req as Request & { user?: typeof session.user }).user = session.user;
    next();
  } catch (error) { next(error); }
}
