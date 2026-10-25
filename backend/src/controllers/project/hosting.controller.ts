/**
 * Project controller: Module 29: Source-Based Hosting.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 29: Source-Based Hosting Handlers
// ---------------------------------------------------------------------------

export async function detectRuntimeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const runtime = await forgeHostingService.detectRuntimeAndFramework(projectId);
    res.status(200).json({ success: true, runtime });
  } catch (err) {
    next(err);
  }
}

export async function createDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.deployFromSource(projectId, req.body || {}, user.id);
    res.status(201).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function promoteDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.promoteArtifact(projectId, req.body, user.id);
    res.status(200).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function rollbackDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.rollbackDeployment(projectId, req.body, user.id);
    res.status(200).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function listDeploymentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const environment = req.query.environment as any;
    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const deployments = await forgeHostingService.listDeployments(projectId, { environment });
    res.status(200).json({ success: true, deployments });
  } catch (err) {
    next(err);
  }
}

export async function getDeploymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const deploymentId = String(req.params.deploymentId);
    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const deployment = await forgeHostingService.getDeploymentById(projectId, deploymentId);
    res.status(200).json({ success: true, deployment });
  } catch (err) {
    next(err);
  }
}

export async function executeDeploymentHealthCheckHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const deploymentId = String(req.params.deploymentId);
    const { forgeHostingService } = await import("../../services/hosting/forgeHosting.service.js");
    const healthCheck = await forgeHostingService.executeHealthCheck(projectId, deploymentId);
    res.status(200).json({ success: true, healthCheck });
  } catch (err) {
    next(err);
  }
}
