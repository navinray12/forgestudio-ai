/**
 * ForgeStudio Execution Blueprint v2.1 — Point 17: Release Integrity, Evidence and Change Safety
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { ReleaseIntegrityController } from "../controllers/releaseIntegrity.controller.ts";

const router = Router();

// 1. Release Request & Transitions
router.post("/releases/request", requireAuth, ReleaseIntegrityController.requestRelease);
router.post("/releases/:releaseId/transition", requireAuth, ReleaseIntegrityController.transitionReleaseState);

// 2. 12 Mandatory Release Gates Evaluation
router.post("/releases/gates/evaluate", requireAuth, ReleaseIntegrityController.evaluateMandatoryGates);

// 3. Trusted Release Passport
router.post("/releases/passport/issue", requireAuth, ReleaseIntegrityController.issuePassport);

// 4. Atomic CAS Promotion
router.post("/releases/:releaseId/promote", requireAuth, ReleaseIntegrityController.promoteRelease);

// 5. Code-Only Rollback
router.post("/releases/rollback", requireAuth, ReleaseIntegrityController.rollbackCode);

export default router;
