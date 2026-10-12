/**
 * Point 07: Generation Routes
 * Maps REST endpoints for reliable generation, state queries, offline regeneration, and diagnostics.
 */

import { Router } from "express";
import { generationController } from "../controllers/generation.controller.js";

const router = Router();

// Job lifecycle endpoints
router.post("/jobs", (req, res) => generationController.createJob(req, res));
router.get("/jobs/:jobId", (req, res) => generationController.getJob(req, res));
router.post("/jobs/:jobId/cancel", (req, res) => generationController.cancelJob(req, res));
router.get("/jobs/:jobId/diagnostics", (req, res) => generationController.getDiagnostics(req, res));
router.post("/jobs/:jobId/override-budget", (req, res) => generationController.overrideBudget(req, res));

// AI-independent deterministic regeneration endpoint
router.post("/regenerate-offline", (req, res) => generationController.regenerateOffline(req, res));

export default router;
