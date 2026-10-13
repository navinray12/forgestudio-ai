import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite } from "../middlewares/tenantScope.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import {
  getPermissionCatalog,
  storeLocalDraftHandler,
  evaluateLocalDraftHandler,
} from "../controllers/ownerExperience.controller.js";

const router = Router();
router.use(requireAuth, userRateLimit(120));

// Versioned permission catalog (static)
router.get("/permissions/catalog", getPermissionCatalog);

// Privacy-safe draft recovery (durable; websiteId comes from the body or query string)
router.post("/drafts/local", userRateLimit(30), scopeToWebsite(), storeLocalDraftHandler);
router.get("/drafts/local/:draftId", scopeToWebsite(), evaluateLocalDraftHandler);

// Not exposed (see controller): /view, /permissions, /roles/custom, /editor-state/*, /journeys/execute.

export default router;
