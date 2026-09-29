import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireBrowserOrigin } from "../middlewares/browser-origin.js";
import { accountSessions } from "../modules/identity/composition.js";
import { AppError } from "../utils/app-error.js";
import { z } from "zod";
const router = Router();
router.post(["/support-token", "/support-login"], (_req, _res, next) =>
  next(new AppError("Unscoped impersonation has been retired. Use an approved support grant.", 410, "SUPPORT_TOKEN_RETIRED")));
router.get("/sessions", requireAuth, async (_req, res) => {
  const data = await accountSessions.list({ userId: res.locals.user.id, sessionId: res.locals.session.id });
  res.json({ success: true, data });
});
router.post("/sessions/:id/revoke", requireAuth, requireBrowserOrigin, async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await accountSessions.revoke({ userId: res.locals.user.id, sessionId: res.locals.session.id }, id);
  res.json({ success: true });
});
router.post(["/revoke-support-tokens", "/sessions/revoke-all"], requireAuth, requireBrowserOrigin, async (_req, res) => {
  await accountSessions.revokeAll({ userId: res.locals.user.id, sessionId: res.locals.session.id });
  res.json({ success: true });
});
export default router;
