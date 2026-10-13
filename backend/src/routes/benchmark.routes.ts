/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Benchmark Routes
 *
 * Competitor evidence and benchmark runs are internal platform data: every route requires a
 * platform administrator.
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requirePlatformAdmin } from "../middlewares/tenantScope.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import {
  getCompetitorEvidenceHandler,
  getCompetitorEvidenceByRefHandler,
  getBenchmarkTasksHandler,
  getBenchmarkTaskByIdHandler,
  getSyntheticBriefsHandler,
  getSyntheticBriefByIdHandler,
  recordBenchmarkRunHandler,
  listBenchmarkRunsHandler,
  getBenchmarkRunByIdHandler,
} from "../controllers/benchmark.controller.js";

const router = Router();
router.use(requireAuth, requirePlatformAdmin, userRateLimit(120));

// Competitor Evidence Registry [R1] - [R8]
router.get("/competitors", getCompetitorEvidenceHandler);
router.get("/competitors/:refId", getCompetitorEvidenceByRefHandler);

// Benchmark Task Definitions (10 Tasks)
router.get("/tasks", getBenchmarkTasksHandler);
router.get("/tasks/:taskId", getBenchmarkTaskByIdHandler);

// Synthetic Business Briefs (10 Briefs)
router.get("/briefs", getSyntheticBriefsHandler);
router.get("/briefs/:briefId", getSyntheticBriefByIdHandler);

// Benchmark Run Recording & Retrieval (durable)
router.get("/runs", listBenchmarkRunsHandler);
router.get("/runs/:runId", getBenchmarkRunByIdHandler);
router.post("/runs", userRateLimit(20), recordBenchmarkRunHandler);

// Not exposed (see controller): /execute-automated.

export default router;
