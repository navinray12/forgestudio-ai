import { Router } from "express";
import { z } from "zod";
import type { LocalAuthentication } from "../application/local-authentication.js";
import { localAuthentication } from "../composition.js";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, AUTH_CHALLENGE_COOKIE, AUTH_CHALLENGE_OPTIONS,
  localAuthenticationEnabled } from "../../../config/auth.js";
import { requireBrowserOrigin } from "../../../middlewares/browser-origin.js";
import { AppError } from "../../../utils/app-error.js";

const email = z.string().trim().toLowerCase().max(254).email();
const credentials = z.object({ identifier: email, password: z.string().min(1).max(1024) }).strict();
const signup = credentials.extend({ fullName: z.string().trim().min(2).max(120), password: z.string().min(12).max(1024) });
const challenge = z.object({ userId: z.uuid(), channel: z.literal("EMAIL").optional() }).strict();
const verify = challenge.extend({ otp: z.string().min(1).max(64) });

export function createLocalIdentityRouter(service: LocalAuthentication = localAuthentication) {
  const router = Router();
  router.use(/^\/(login|signup)(\/|$)/, (req, _res, next) => {
    if (!localAuthenticationEnabled()) return next(new AppError("Use the configured identity provider.", 403, "MANAGED_LOGIN_REQUIRED"));
    if (req.method !== "POST" || !req.is("application/json")) {
      return next(new AppError("A JSON authentication request is required.", 415, "JSON_REQUIRED"));
    }
    next();
  }, requireBrowserOrigin);
  router.post("/login", async (req, res) => {
    const input = credentials.parse(req.body);
    const result = await service.beginLogin(input.identifier, input.password, req.ip ?? "unknown");
    res.cookie(AUTH_CHALLENGE_COOKIE, result.secret, AUTH_CHALLENGE_OPTIONS);
    res.json({ success: true, requireChannelSelection: true,
      data: { userId: result.user.id, email: result.user.email, phone: null, channels: ["EMAIL"] } });
  });
  router.post("/signup", async (req, res) => {
    const input = signup.parse(req.body);
    const result = await service.beginSignup(input.identifier, input.fullName, input.password, req.ip ?? "unknown");
    res.cookie(AUTH_CHALLENGE_COOKIE, result.secret, AUTH_CHALLENGE_OPTIONS);
    await service.sendCode(result.secret, result.user.id, "SIGNUP");
    res.status(201).json({ success: true, requireOtp: true, data: { userId: result.user.id, email: result.user.email } });
  });
  for (const [prefix, purpose] of [["login", "LOGIN"], ["signup", "SIGNUP"]] as const) {
    for (const action of ["send-otp", "resend-otp"]) {
      router.post(`/${prefix}/${action}`, async (req, res) => {
        const input = challenge.parse(req.body);
        await service.sendCode(req.cookies?.[AUTH_CHALLENGE_COOKIE], input.userId, purpose);
        res.json({ success: true, requireOtp: true, message: "Code accepted for delivery." });
      });
    }
    router.post(`/${prefix}/verify-otp`, async (req, res) => {
      const input = verify.parse(req.body);
      const result = await service.finish(req.cookies?.[AUTH_CHALLENGE_COOKIE], input.userId, purpose, input.otp);
      res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
      res.clearCookie(AUTH_CHALLENGE_COOKIE, AUTH_CHALLENGE_OPTIONS);
      res.json({ success: true, data: { user: result.user } });
    });
  }
  return router;
}
