/**
 * Project controller: Blueprint Point 46: Reconcile Architecture and API Contracts.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { syncSourceToVisualWebsite } from "../../services/compiler/visualCodeSync.service.js";
import { recordCheckpoint, kindForSyncStatus } from "../../services/workspace/workspaceCheckpoints.service.js";
import { controlPlaneReconciliationService } from "../../services/architecture/controlPlaneReconciliation.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Blueprint Point 46: Reconcile Architecture and API Contracts
// ---------------------------------------------------------------------------

export async function validateGeneratedPackageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { files = [] } = req.body;
    const manifest = controlPlaneReconciliationService.validateGeneratedPackage(files);
    res.status(200).json({ success: true, manifest });
  } catch (err) {
    next(err);
  }
}

export async function verifyControlPlaneDiagnosticsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const environment = String(req.query.environment || "DEVELOPMENT");
    const diagnostics = controlPlaneReconciliationService.verifyControlPlaneConnection(projectId, environment);
    res.status(200).json({ success: true, diagnostics });
  } catch (err) {
    next(err);
  }
}

export async function syncCodeToVisualHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    if (!project.websiteId) {
      return res.status(400).json({
        success: false,
        message: "Project is not linked to a Visual Website",
      });
    }

    const { filePath, resolve } = req.body;
    if (typeof filePath !== "string" || !filePath.trim()) {
      return res.status(400).json({ success: false, message: "filePath is required" });
    }
    if (resolve !== undefined && resolve !== "code" && resolve !== "visual") {
      return res.status(400).json({ success: false, message: "resolve must be 'code' or 'visual'" });
    }
    const result = await syncSourceToVisualWebsite(projectId, project.websiteId, filePath, user.id, { resolve });
    const checkpoint = await recordCheckpoint({
      projectId,
      websiteId: project.websiteId,
      origin: "CODE",
      kind: kindForSyncStatus(result.status),
      filePath,
      message: result.message ?? null,
      actorId: user.id,
    });
    res.status(200).json({ ...result, checkpointId: checkpoint.id, checkpoint: { id: checkpoint.id, sequence: checkpoint.sequence, kind: checkpoint.kind } });
  } catch (err) {
    next(err);
  }
}
