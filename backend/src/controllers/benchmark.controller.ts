/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Benchmark Controller
 */

import type { Request, Response, NextFunction } from "express";
import { benchmarkService } from "../services/benchmark/benchmark.service.js";

export async function getCompetitorEvidenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = benchmarkService.getCompetitorEvidence();
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getCompetitorEvidenceByRefHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const refId = decodeURIComponent(req.params.refId as string);
    const item = benchmarkService.getCompetitorEvidenceByRefId(refId);
    res.status(200).json({ success: true, evidence: item });
  } catch (error) {
    next(error);
  }
}

export async function getBenchmarkTasksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tasks = benchmarkService.getTasks();
    res.status(200).json({ success: true, ...tasks });
  } catch (error) {
    next(error);
  }
}

export async function getBenchmarkTaskByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.taskId as string;
    const task = benchmarkService.getTaskById(taskId);
    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
}

export async function getSyntheticBriefsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const briefs = benchmarkService.getBriefs();
    res.status(200).json({ success: true, ...briefs });
  } catch (error) {
    next(error);
  }
}

export async function getSyntheticBriefByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const briefId = req.params.briefId as string;
    const brief = benchmarkService.getBriefById(briefId);
    res.status(200).json({ success: true, brief });
  } catch (error) {
    next(error);
  }
}

export async function executeAutomatedQualificationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { taskId, briefId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, error: "taskId is required in request body." });
    }
    const result = await benchmarkService.executeAutomatedQualification(taskId, briefId);
    res.status(200).json({ success: true, qualificationResult: result });
  } catch (error) {
    next(error);
  }
}

export async function recordBenchmarkRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user || { id: "anonymous-operator" };
    const { config, taskResults, knownLimitations } = req.body;
    if (!config || !taskResults) {
      return res.status(400).json({
        success: false,
        error: "config and taskResults arrays are required in request body.",
      });
    }
    const report = await benchmarkService.recordBenchmarkRun(user.id, {
      config,
      taskResults,
      knownLimitations,
    });
    res.status(201).json({ success: true, report });
  } catch (error) {
    next(error);
  }
}

export async function listBenchmarkRunsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const runs = benchmarkService.listBenchmarkRuns();
    res.status(200).json({ success: true, runs });
  } catch (error) {
    next(error);
  }
}

export async function getBenchmarkRunByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const runId = req.params.runId as string;
    const report = benchmarkService.getBenchmarkRunById(runId);
    res.status(200).json({ success: true, report });
  } catch (error) {
    next(error);
  }
}
