import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite } from "../middlewares/tenantScope.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import {
  resolveRouteDeliveryHandler,
  createFactOfferHandler,
  previewOfferImpactHandler,
  sanitizeMediaRightsHandler,
} from "../controllers/searchQuality.controller.js";

const router = Router();
router.use(requireAuth, userRateLimit(120));

// Route delivery & SEO status (calculation)
router.post("/routes/resolve", resolveRouteDeliveryHandler);

// Fact & Offer register (durable, website-scoped)
router.post("/facts", userRateLimit(30), scopeToWebsite(), createFactOfferHandler);
router.post("/facts/preview-impact", scopeToWebsite(), previewOfferImpactHandler);

// Media rights & sanitized metadata (calculation)
router.post("/media/sanitize-rights", sanitizeMediaRightsHandler);

// Not exposed (see controller): /readiness, /ai-search/evaluate.

export default router;
