/**
 * Project controller: Reference project benchmark.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { ReferenceProjectBenchmarkService } from "../../services/benchmark/referenceProjectBenchmark.service.js";
import { getAuthUser } from "./shared.js";

export async function runReferenceBenchmarkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    getAuthUser(res, req);
    const iterations = Number(req.body.iterations || 10);
    const report = await ReferenceProjectBenchmarkService.runBenchmark(iterations);

    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}
