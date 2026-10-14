/**
 * ForgeStudio Execution Blueprint v2.1 — Point 20: Service Objectives and Failure Behavior
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { ServiceObjectivesController } from "../controllers/serviceObjectives.controller.js";

const router = Router();

// 1. Proposed Starting Target SLO Register
router.get("/slo/register", requireAuth, ServiceObjectivesController.listSLOs);

// 2. Failure Isolation Contracts
router.post("/failure/evaluate", requireAuth, ServiceObjectivesController.evaluateFailureIsolation);

// 3. Incident Alerts
router.get("/alerts", requireAuth, ServiceObjectivesController.getAlertDefinitions);

// 4. Error Budget & Release Freezes
router.get("/error-budget", requireAuth, ServiceObjectivesController.evaluateErrorBudget);

export default router;
