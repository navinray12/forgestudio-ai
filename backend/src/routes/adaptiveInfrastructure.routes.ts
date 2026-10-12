/**
 * ForgeStudio Execution Blueprint v2.1 — Point 19: Adaptive Infrastructure and Operating Economics
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { AdaptiveInfrastructureController } from "../controllers/adaptiveInfrastructure.controller.ts";

const router = Router();

// 1. Versioned Infrastructure Profiles
router.get("/profiles", requireAuth, AdaptiveInfrastructureController.listProfiles);

// 2. Migration Planning & Preflight
router.post("/profiles/plan-migration", requireAuth, AdaptiveInfrastructureController.generateMigrationPlan);

// 3. Upgrade Infrastructure Action
router.post("/upgrade/execute", requireAuth, AdaptiveInfrastructureController.executeUpgrade);

// 4. Autoscaling Evaluation
router.post("/autoscaling/evaluate", requireAuth, AdaptiveInfrastructureController.evaluateAutoscaling);

// 5. Operating Economics Scenarios
router.get("/economics/scenarios", requireAuth, AdaptiveInfrastructureController.getCostScenarios);

export default router;
