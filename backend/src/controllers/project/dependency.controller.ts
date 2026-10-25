/**
 * Project controller: Module 10: Dependency Manager.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 10: Dependency Manager
// ---------------------------------------------------------------------------

export async function getDependenciesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeDependencyService } = await import("../../services/dependency/forgeDependency.service.js");
    const analysis = await forgeDependencyService.analyzeDependencies(projectId);
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
}

export async function installDependencyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, version, isDev, isExact } = req.body;
    const { forgeDependencyService } = await import("../../services/dependency/forgeDependency.service.js");
    const result = await forgeDependencyService.installDependency(projectId, name, {
      version,
      isDev,
      isExact,
      authorId: user.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeDependencyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name } = req.body;
    const { forgeDependencyService } = await import("../../services/dependency/forgeDependency.service.js");
    const result = await forgeDependencyService.removeDependency(projectId, name, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function explainDependencyAiHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { errorMessage } = req.body;
    const { forgeDependencyService } = await import("../../services/dependency/forgeDependency.service.js");
    const analysis = await forgeDependencyService.analyzeDependencies(projectId);
    const explanation = forgeDependencyService.explainDependencyFailureWithAI({
      errorMessage: errorMessage || "Unknown error",
      analysis,
    });
    res.status(200).json({ success: true, ...explanation });
  } catch (err) {
    next(err);
  }
}
