import { Router } from "express";
import { createOAuthPasswordController } from "../controllers/oauth.controller.js";
import { logout } from "../controllers/auth.controller.js";
import { requireBrowserOrigin } from "../middlewares/browser-origin.js";
import { AppError } from "../utils/app-error.js";
const router = Router();
router.post("/create-password", requireBrowserOrigin, createOAuthPasswordController);
router.get(["/google", "/github", "/google/callback", "/github/callback"], (_req, _res, next) =>
  next(new AppError("Select managed sign-in. Social providers are configured at the identity provider.", 410, "LEGACY_OAUTH_RETIRED")));
router.post("/logout", requireBrowserOrigin, logout);
export default router;
