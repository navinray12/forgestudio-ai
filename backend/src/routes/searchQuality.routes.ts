import { Router } from "express";
import {
  resolveRouteDeliveryHandler,
  getSearchReadinessHandler,
  evaluateAiSearchHandler,
  createFactOfferHandler,
  previewOfferImpactHandler,
  sanitizeMediaRightsHandler,
} from "../controllers/searchQuality.controller.js";

const router = Router();

// Route delivery & SEO status
router.post("/routes/resolve", resolveRouteDeliveryHandler);

// Search readiness report
router.get("/readiness", getSearchReadinessHandler);

// AI search compliance
router.post("/ai-search/evaluate", evaluateAiSearchHandler);

// Fact & Offer register
router.post("/facts", createFactOfferHandler);
router.post("/facts/preview-impact", previewOfferImpactHandler);

// Media rights & sanitized metadata
router.post("/media/sanitize-rights", sanitizeMediaRightsHandler);

export default router;
