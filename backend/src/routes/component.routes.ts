/**
 * Point 08: Component Routes
 * Exposes endpoints for component contracts, quarantine source imports, 3-way reconciliation, and behavior gates.
 */

import { Router } from "express";
import { componentController } from "../controllers/component.controller.js";

const router = Router();

// Component Contract endpoints
router.get("/contracts", (req, res) => componentController.listContracts(req, res));
router.get("/contracts/:componentId", (req, res) => componentController.getContract(req, res));
router.post("/validate", (req, res) => componentController.validateInstance(req, res));

// Custom source import into quarantine
router.post("/source/import", (req, res) => componentController.importSource(req, res));

// Three-way source reconciliation & conflict management
router.post("/source/reconcile", (req, res) => componentController.reconcileSource(req, res));
router.get("/source/conflicts/:websiteId", (req, res) => componentController.getConflicts(req, res));
router.post("/source/conflicts/:conflictId/resolve", (req, res) => componentController.resolveConflict(req, res));

// Behavioral review gate for business logic changes
router.post("/behavior/review", (req, res) => componentController.reviewBehavior(req, res));

export default router;
