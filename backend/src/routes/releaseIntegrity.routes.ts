/**
 * ForgeStudio Execution Blueprint v2.1 — Point 17: Release Integrity, Evidence and Change Safety
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite, requirePlatformAdmin } from "../middlewares/tenantScope.middleware.js";
import { ReleaseIntegrityController } from "../controllers/releaseIntegrity.controller.js";

const router = Router();

// 1. Release Request & Transitions
router.post("/releases/request", requireAuth, scopeToWebsite({ admin: true }), ReleaseIntegrityController.requestRelease);
router.post("/releases/:releaseId/transition", requireAuth, scopeToWebsite({ admin: true }), ReleaseIntegrityController.transitionReleaseState);

// 2. 12 Mandatory Release Gates Evaluation
router.post("/releases/gates/evaluate", requireAuth, ReleaseIntegrityController.evaluateMandatoryGates);

// 3. Trusted Release Passport
// Not exposed: the passport would be signed as the trusted verifier from client-supplied gate
// attestations, which is self-issued evidence (blueprint §17, FS21-AT-GEN-14).

// 4. Atomic CAS Promotion
router.post("/releases/:releaseId/promote", requireAuth, scopeToWebsite({ admin: true }), ReleaseIntegrityController.promoteRelease);

// 5. Code-Only Rollback
router.post("/releases/rollback", requireAuth, scopeToWebsite({ admin: true }), ReleaseIntegrityController.rollbackCode);

export default router;
