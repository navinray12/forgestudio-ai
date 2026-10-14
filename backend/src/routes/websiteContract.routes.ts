/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Website Contract & Baseline Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authorizeCapability } from "../services/permission.service.js";
import {
  getWebsiteContractHandler,
  validateWebsiteContractHandler,
  provisionBaselineHandler,
  auditActionsHandler,
} from "../controllers/websiteContract.controller.js";

const router = Router();

// Ensure all contract mutations and audits require authentication
router.use(requireAuth);

router.get("/:id/contract", authorizeCapability("VIEW"), getWebsiteContractHandler);
router.post("/:id/contract/validate", authorizeCapability("VIEW"), validateWebsiteContractHandler);
router.post("/:id/contract/provision-baseline", authorizeCapability("EDIT"), provisionBaselineHandler);
router.get("/:id/actions/audit", authorizeCapability("VIEW"), auditActionsHandler);

export default router;
