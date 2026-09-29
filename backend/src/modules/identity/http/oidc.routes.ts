import { Router } from "express";
import { z } from "zod";
import { OidcAuthentication } from "../application/oidc-authentication.js";
import { localAuthentication, oidcAuthentication } from "../composition.js";
import { requireBrowserOrigin } from "../../../middlewares/browser-origin.js";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { authenticateSession } from "../../../services/session-authentication.js";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, AUTH_CHALLENGE_COOKIE, AUTH_CHALLENGE_OPTIONS,
  browserOrigin, localAuthenticationEnabled } from "../../../config/auth.js";
import { AppError } from "../../../utils/app-error.js";

export function createOidcRouter(identity: OidcAuthentication | null = oidcAuthentication) {
  const router = Router();
  router.get("/capabilities", (_req, res) => res.setHeader("Cache-Control", "no-store") &&
    res.json({ success: true, data: { local: localAuthenticationEnabled(), managed: !!identity, phone: false } }));
  router.post(["/oidc/start", "/oidc/link"], requireBrowserOrigin, async (req, res, next) => {
    if (!identity) throw new AppError("Managed sign-in is not configured.", 503, "IDENTITY_PROVIDER_UNAVAILABLE");
    if (!req.is("application/json")) throw new AppError("A JSON request is required.", 415, "JSON_REQUIRED");
    z.object({}).strict().parse(req.body);
    await localAuthentication.rateLimit("oidc-start-ip", req.ip ?? "unknown", 60);
    if (req.path === "/oidc/link") {
      return requireAuth(req, res, async error => {
        if (error) return next(error);
        try {
          const result = await identity.begin({ userId: res.locals.user.id, sessionId: res.locals.session.id });
          res.cookie(AUTH_CHALLENGE_COOKIE, result.secret, AUTH_CHALLENGE_OPTIONS);
          res.json({ success: true, data: { authorizationUrl: result.url } });
        } catch (error) { next(error); }
      });
    }
    const result = await identity.begin();
    res.cookie(AUTH_CHALLENGE_COOKIE, result.secret, AUTH_CHALLENGE_OPTIONS);
    res.json({ success: true, data: { authorizationUrl: result.url } });
  });
  router.get("/oidc/callback", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer");
    res.clearCookie(AUTH_CHALLENGE_COOKIE, AUTH_CHALLENGE_OPTIONS);
    try {
      if (!identity) throw new AppError("Managed sign-in is not configured.", 503, "IDENTITY_PROVIDER_UNAVAILABLE");
      if (req.originalUrl.length > 8192) throw new AppError("Invalid callback.", 400, "INVALID_AUTHENTICATION");
      const callback = new URL(identity.callbackUrl);
      callback.search = new URL(req.originalUrl, "http://callback.invalid").search;
      const current = await authenticateSession(req.cookies?.[AUTH_COOKIE_NAME]);
      const result = await identity.finish(req.cookies?.[AUTH_CHALLENGE_COOKIE], callback, current?.id);
      res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
      res.redirect(303, `${browserOrigin()}/dashboard`);
    } catch (error) { next(error); }
  });
  return router;
}
export default createOidcRouter();
