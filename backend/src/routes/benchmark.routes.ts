/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Benchmark Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getCompetitorEvidenceHandler,
  getCompetitorEvidenceByRefHandler,
  getBenchmarkTasksHandler,
  getBenchmarkTaskByIdHandler,
  getSyntheticBriefsHandler,
  getSyntheticBriefByIdHandler,
  executeAutomatedQualificationHandler,
  recordBenchmarkRunHandler,
  listBenchmarkRunsHandler,
  getBenchmarkRunByIdHandler,
} from "../controllers/benchmark.controller.js";

const router = Router();

// Competitor Evidence Registry [R1] - [R8]
router.get("/competitors", getCompetitorEvidenceHandler);
router.get("/competitors/:refId", getCompetitorEvidenceByRefHandler);

// Benchmark Task Definitions (10 Tasks)
router.get("/tasks", getBenchmarkTasksHandler);
router.get("/tasks/:taskId", getBenchmarkTaskByIdHandler);

// Synthetic Business Briefs (10 Briefs)
router.get("/briefs", getSyntheticBriefsHandler);
router.get("/briefs/:briefId", getSyntheticBriefByIdHandler);

// Automated Technical Qualification Execution
router.post("/execute-automated", requireAuth, executeAutomatedQualificationHandler);

// Benchmark Run Recording & Retrieval
router.get("/runs", listBenchmarkRunsHandler);
router.get("/runs/:runId", getBenchmarkRunByIdHandler);
router.post("/runs", requireAuth, recordBenchmarkRunHandler);

export default router;
