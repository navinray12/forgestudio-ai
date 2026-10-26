/**
 * Project controller: Module 30: CI/CD Pipeline.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 30: CI/CD Pipeline Handlers
// ---------------------------------------------------------------------------

export async function createPipelineRunHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeCicdService } = await import("../../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.createPipelineRun({
      projectId,
      ...req.body,
      userId: user.id,
    });
    res.status(201).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function listPipelinesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeCicdService } = await import("../../services/hosting/forgeCicd.service.js");
    const pipelines = await forgeCicdService.listProjectPipelines(projectId);
    res.status(200).json({ success: true, pipelines });
  } catch (err) {
    next(err);
  }
}

export async function getPipelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.getPipelineById(projectId, pipelineId);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function approvePipelineGateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.approvePipelineGate(projectId, pipelineId, user.id, req.body?.notes);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function rerunPipelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.rerunPipeline(projectId, pipelineId, user.id);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}

export async function cancelPipelineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const pipelineId = String(req.params.pipelineId);
    const { forgeCicdService } = await import("../../services/hosting/forgeCicd.service.js");
    const pipeline = await forgeCicdService.cancelPipeline(pipelineId, user.id);
    res.status(200).json({ success: true, pipeline });
  } catch (err) {
    next(err);
  }
}
