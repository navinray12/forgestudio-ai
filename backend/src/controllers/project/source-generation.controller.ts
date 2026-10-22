/**
 * Project controller: Blueprint Point 37: Dynamic Source Generation & Safe Cleanup.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { DynamicSourcePlannerService } from "../../services/generator/dynamicSourcePlanner.service.js";
import { SafeCleanupEngineService } from "../../services/generator/safeCleanupEngine.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Blueprint Point 37: Dynamic Source Generation & Safe Cleanup
// ---------------------------------------------------------------------------

export async function planSymbolsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { items } = req.body;
    const plansMap = DynamicSourcePlannerService.planSymbols(Array.isArray(items) ? items : []);
    const plans = Object.fromEntries(plansMap.entries());

    res.status(200).json({ success: true, plans });
  } catch (err) {
    next(err);
  }
}

export async function evaluateRegenerationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { plannedModule, existingRecord } = req.body;
    const decision = DynamicSourcePlannerService.evaluateRegenerationSafety(
      plannedModule,
      existingRecord
    );

    res.status(200).json({ success: true, decision });
  } catch (err) {
    next(err);
  }
}

export async function createCleanupPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { previousManifestFiles, newPlannedPaths, checkpointId } = req.body;
    const plan = SafeCleanupEngineService.createRemovalPlan(
      projectId,
      checkpointId || "cp_current",
      Array.isArray(previousManifestFiles) ? previousManifestFiles : [],
      new Set(Array.isArray(newPlannedPaths) ? newPlannedPaths : [])
    );

    res.status(200).json({ success: true, removalManifest: plan });
  } catch (err) {
    next(err);
  }
}

export async function applyCleanupPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { manifestId, currentFiles } = req.body;
    const currentFilesMap = new Map<string, { contentHash: string; isModifiedSince: boolean }>(
      Object.entries(currentFiles || {})
    );

    const result = SafeCleanupEngineService.applyRemovalPlan(manifestId, currentFilesMap);
    res.status(result.success ? 200 : 409).json(result);
  } catch (err) {
    next(err);
  }
}
