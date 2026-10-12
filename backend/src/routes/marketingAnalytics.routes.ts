import { Router } from "express";
import {
  recordConsentHandler,
  withdrawConsentHandler,
  validateEventHandler,
  buildUtmLinkHandler,
  calculateMetricsHandler,
  dispatchConversionHandler,
} from "../controllers/marketingAnalytics.controller.js";

const router = Router();

// Consent management
router.post("/consent", recordConsentHandler);
router.post("/consent/withdraw", withdrawConsentHandler);

// Measurement event validation
router.post("/events/validate", validateEventHandler);

// UTM Campaign builder
router.post("/utm/build", buildUtmLinkHandler);

// Truthful Growth Metrics
router.post("/metrics/calculate", calculateMetricsHandler);

// Provider conversion dispatch
router.post("/conversions/dispatch", dispatchConversionHandler);

export default router;
