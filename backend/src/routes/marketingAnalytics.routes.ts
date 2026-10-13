import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite } from "../middlewares/tenantScope.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import {
  recordConsentHandler,
  withdrawConsentHandler,
  validateEventHandler,
  buildUtmLinkHandler,
  calculateMetricsHandler,
} from "../controllers/marketingAnalytics.controller.js";

const router = Router();
router.use(requireAuth, userRateLimit(120));
const writes = userRateLimit(30);

// Consent management (durable, website-scoped)
router.post("/consent", writes, scopeToWebsite(), recordConsentHandler);
router.post("/consent/withdraw", writes, scopeToWebsite(), withdrawConsentHandler);

// Measurement event validation
router.post("/events/validate", validateEventHandler);

// UTM Campaign builder
router.post("/utm/build", buildUtmLinkHandler);

// Truthful Growth Metrics
router.post("/metrics/calculate", calculateMetricsHandler);

// Not exposed (see controller): /conversions/dispatch.

export default router;
