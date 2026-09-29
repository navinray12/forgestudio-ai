import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, AUTH_CHALLENGE_COOKIE, AUTH_CHALLENGE_OPTIONS } from "../config/auth.js";
import { accountSessions } from "../modules/identity/composition.js";
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await accountSessions.logout(req.cookies?.[AUTH_COOKIE_NAME]);
    res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
    res.clearCookie(AUTH_CHALLENGE_COOKIE, AUTH_CHALLENGE_OPTIONS);
    res.clearCookie("forge_session", AUTH_COOKIE_OPTIONS);
    res.json({ success: true, message: "Signed out." });
  } catch (error) { next(error); }
}
