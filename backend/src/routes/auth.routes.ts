import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireBrowserOrigin } from "../middlewares/browser-origin.js";
import { accountSessions } from "../modules/identity/composition.js";
import { AppError } from "../utils/app-error.js";
import { z } from "zod";
import { localAuthenticationEnabled } from "../config/auth.js";

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

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both current password and new password are required." });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters long." });
    }
    const { prisma } = await import("../config/prisma.js");
    const { hashPassword, verifyPassword } = await import("../utils/password.js");

    const user = await prisma.user.findUnique({ where: { id: res.locals.user.id } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ success: false, message: "No password currently set for this account." });
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
    return res.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to update password." });
  }
});

router.get("/capabilities", (_req, res) => {
  const local = localAuthenticationEnabled();
  res.json({
    success: true,
    data: {
      local,
      managed: false,
      phone: false,
    },
  });
});

export default router;
