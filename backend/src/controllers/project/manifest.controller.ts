/**
 * Project controller: Project Manifest.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getProjectManifest, updateProjectManifest } from "../../services/project/forgeManifest.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Project Manifest
// ---------------------------------------------------------------------------

export async function getManifestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const result = await getProjectManifest(projectId, user);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateManifestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const result = await updateProjectManifest(projectId, req.body, user);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
