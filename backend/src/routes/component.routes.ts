/**
 * Point 08: Component Routes
 * Exposes endpoints for component contracts and quarantine source imports.
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite } from "../middlewares/tenantScope.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import { componentController } from "../controllers/component.controller.js";

const router = Router();
router.use(requireAuth, userRateLimit(120));

// Component Contract endpoints
router.get("/contracts", (req, res, next) => componentController.listContracts(req, res, next));
router.get("/contracts/:componentId", (req, res, next) => componentController.getContract(req, res, next));
router.post("/validate", (req, res, next) => componentController.validateInstance(req, res, next));

// Custom source import into quarantine (durable, website-scoped)
router.post("/source/import", userRateLimit(10), scopeToWebsite(), (req, res, next) => componentController.importSource(req, res, next));

// Not exposed (see controller): /source/reconcile, /source/conflicts/*, /behavior/review.

export default router;
