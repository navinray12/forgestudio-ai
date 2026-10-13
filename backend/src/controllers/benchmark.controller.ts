/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Benchmark Controller (platform administrators only)
 *
 * Runs are operator-submitted reports stored in forge_benchmark_runs.
 *
 * Not exposed: /execute-automated. It returns hard-coded PASSED measurements and artifact paths
 * for several tasks without running them.
 */

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { benchmarkService } from "../services/benchmark/benchmark.service.js";
import { getBenchmarkRun, listBenchmarkRuns, recordBenchmarkRun } from "../services/benchmark/benchmarkRunStore.service.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const seconds = z.number().nonnegative();

const runInput = z.object({
  config: z.object({
    protocolVersion: text(20),
    productName: text(120),
    productVersion: text(60),
    purchasedPlanOrEntitlement: text(200),
    briefId: text(120),
    operatorExperienceLevel: z.enum(["NOVICE", "BUSINESS_USER", "PROFESSIONAL_DESIGNER", "SOFTWARE_ENGINEER"]),
    enabledIntegrations: z.array(text(120)).max(100),
    startingConditions: z.string().max(4000),
    preparedAssetsDescription: z.string().max(4000),
    costAssumptionsDescription: z.string().max(4000),
    actualCostUsd: z.number().nonnegative(),
  }),
  taskResults: z
    .array(
      z.object({
        taskId: text(120),
        taskName: text(300),
        status: z.enum(["PASSED", "FAILED", "BLOCKED", "NOT_YET_MEASURED"]),
        activeElapsedSeconds: seconds,
        totalElapsedSeconds: seconds,
        assistanceInterventionsCount: z.number().int().nonnegative(),
        defects: z
          .array(
            z.object({
              severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
              description: text(2000),
              evidenceReference: z.string().max(500).optional(),
            })
          )
          .max(200),
        isCriticalFailure: z.boolean(),
        notes: z.string().max(4000),
        rawMetrics: z.record(z.string(), z.unknown()),
        evidenceArtifactUrls: z.array(z.string().max(500)).max(100),
      })
    )
    .min(1)
    .max(50),
  knownLimitations: z.array(z.string().max(1000)).max(50).optional(),
});

export async function getCompetitorEvidenceHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, ...benchmarkService.getCompetitorEvidence() });
  } catch (error) {
    next(error);
  }
}

export async function getCompetitorEvidenceByRefHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const item = benchmarkService.getCompetitorEvidenceByRefId(String(req.params.refId));
    res.status(200).json({ success: true, evidence: item });
  } catch (error) {
    next(error);
  }
}

export async function getBenchmarkTasksHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, ...benchmarkService.getTasks() });
  } catch (error) {
    next(error);
  }
}

export async function getBenchmarkTaskByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, task: benchmarkService.getTaskById(String(req.params.taskId)) });
  } catch (error) {
    next(error);
  }
}

export async function getSyntheticBriefsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, ...benchmarkService.getBriefs() });
  } catch (error) {
    next(error);
  }
}

export async function getSyntheticBriefByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, brief: benchmarkService.getBriefById(String(req.params.briefId)) });
  } catch (error) {
    next(error);
  }
}

export async function recordBenchmarkRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { report, replayed } = await recordBenchmarkRun(res.locals.user, runInput.parse(req.body));
    res.status(replayed ? 200 : 201).json({ success: true, report, idempotentReplay: replayed });
  } catch (error) {
    next(error);
  }
}

export async function listBenchmarkRunsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, runs: await listBenchmarkRuns(res.locals.user) });
  } catch (error) {
    next(error);
  }
}

export async function getBenchmarkRunByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, report: await getBenchmarkRun(res.locals.user, String(req.params.runId)) });
  } catch (error) {
    next(error);
  }
}
