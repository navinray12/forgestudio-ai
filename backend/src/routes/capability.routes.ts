/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Capability & Evidence Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listCapabilitiesHandler,
  getManifestHandler,
  getAdminNavigationHandler,
  getCapabilityByIdHandler,
  getPrerequisitesHandler,
  activateCapabilityHandler,
  previewDisableHandler,
  disableCapabilityHandler,
  recordEvidenceHandler,
  evaluateReleaseGateHandler,
} from "../controllers/capability.controller.js";

const router = Router();

// Public / Authenticated discovery endpoints
router.get("/", listCapabilitiesHandler);
router.get("/manifest", getManifestHandler);
router.get("/navigation", getAdminNavigationHandler);
router.post("/release-gate/evaluate", evaluateReleaseGateHandler);

// Single capability inspection
router.get("/:id", getCapabilityByIdHandler);
router.get("/:id/prerequisites", getPrerequisitesHandler);
router.get("/:id/disable-preview", previewDisableHandler);

// Governed mutations require authentication
router.post("/:id/activate", requireAuth, activateCapabilityHandler);
router.post("/:id/disable", requireAuth, disableCapabilityHandler);
router.post("/:id/evidence", requireAuth, recordEvidenceHandler);

export default router;
