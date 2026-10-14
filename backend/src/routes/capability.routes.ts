/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Capability registry routes (read-only)
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import {
  listCapabilitiesHandler,
  getManifestHandler,
  getCapabilityByIdHandler,
} from "../controllers/capability.controller.js";

const router = Router();
router.use(requireAuth, userRateLimit(120));

router.get("/", listCapabilitiesHandler);
router.get("/manifest", getManifestHandler);
router.get("/:id", getCapabilityByIdHandler);

// Not exposed (see controller): /navigation, /release-gate/evaluate, /:id/prerequisites,
// /:id/disable-preview, /:id/activate, /:id/disable, /:id/evidence.

export default router;
