import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME } from "../config/auth.js";
import { verifyApiKey } from "../services/apiKey.service.js";
import { authenticateSession } from "../services/session-authentication.js";
import { AppError } from "../utils/app-error.js";

export async function authenticateApiV1(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    let token: unknown = req.cookies?.[AUTH_COOKIE_NAME];
    if (header !== undefined) {
      if (typeof header !== "string" || !header.startsWith("Bearer ")) {
        throw new AppError("Invalid authorization scheme", 401, "UNAUTHORIZED");
      }
      token = header.substring(7).trim();
      if (typeof token !== "string" || !token || token.length > 4096) {
        throw new AppError("Invalid authorization credential", 401, "UNAUTHORIZED");
      }
      const keyResult = await verifyApiKey(token);
      if (keyResult && "error" in keyResult) throw new AppError("API key is not active", 401, "UNAUTHORIZED");
      if (keyResult && "user" in keyResult && keyResult.user) {
        if (keyResult.user.status !== "ACTIVE") throw new AppError("Account is not active", 403, "ACCOUNT_INACTIVE");
        res.locals.user = keyResult.user;
        res.locals.apiKey = keyResult.apiKey;
        res.locals.authType = "API_KEY";
        return next();
      }
    }
    // An explicitly supplied invalid Bearer credential never silently selects
    // a different cookie principal. Both session adapters share the same checks.
    const session = await authenticateSession(token);
    if (!session) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    res.locals.user = session.user;
    res.locals.session = session;
    res.locals.authType = "SESSION";
    next();
  } catch (error) {
    next(error); // Central error serialization does not expose database messages.
  }
}

export function requireApiV1Scope(requiredScope: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user || !["SESSION", "API_KEY"].includes(res.locals.authType)) {
      return next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    }
    if (res.locals.authType === "API_KEY") {
      const scopes: unknown[] = Array.isArray(res.locals.apiKey?.scopes) ? res.locals.apiKey.scopes : [];
      const allowed = scopes.includes(requiredScope) || scopes.includes("*") || scopes.includes("all") ||
        (requiredScope.endsWith(":read") && scopes.includes(requiredScope.replace(":read", ":write")));
      if (!allowed) return next(new AppError("API key does not permit this operation", 403, "FORBIDDEN"));
    }
    next();
  };
}
