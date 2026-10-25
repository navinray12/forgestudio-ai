/**
 * Project controller: Module 12: Build System.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 12: Build System
// ---------------------------------------------------------------------------

export async function triggerBuildHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { buildMode, trigger } = req.body;
    const { forgeBuildService } = await import("../../services/build/forgeBuild.service.js");
    const result = await forgeBuildService.runProjectBuild({
      projectId,
      buildMode,
      trigger,
      userId: user.id,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listBuildsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeBuildService } = await import("../../services/build/forgeBuild.service.js");
    const builds = await forgeBuildService.getProjectBuilds(projectId);
    res.status(200).json({ success: true, builds });
  } catch (err) {
    next(err);
  }
}
