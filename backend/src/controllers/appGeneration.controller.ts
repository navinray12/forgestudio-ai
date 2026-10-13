import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { getForgeProjectById } from "../services/project/forgeProject.service.js";
import { appGenerationService } from "../services/appGeneration/appGeneration.service.js";
import { APPROVED_TEMPLATES } from "../services/appGeneration/appModel.js";

/** Resolves the caller and the project they are a member of; tenant scope never comes from the client. */
async function authorizeProject(req: Request, res: Response) {
  const user = res.locals.user || (req as any).user;
  if (!user?.id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  const project = await getForgeProjectById(String(req.params.id), user);
  const tenantId: string = (project as any).workspaceId || project.ownerId;
  return { user, project, tenantId };
}

/** POST /api/v1/projects/:id/app-generations */
export async function createAppGenerationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, project, tenantId } = await authorizeProject(req, res);
    const { mode, brief, templateId } = req.body ?? {};
    const idempotencyKey = req.get("Idempotency-Key") || req.body?.idempotencyKey;
    const { run, created } = await appGenerationService.createRun({
      projectId: project.id,
      tenantId,
      requestedById: user.id,
      mode,
      brief,
      templateId,
      idempotencyKey,
    });
    res.status(created ? 202 : 200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/projects/:id/app-generations */
export async function listAppGenerationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { project } = await authorizeProject(req, res);
    const runs = await appGenerationService.listRuns(project.id, Number(req.query.limit) || 20);
    res.json({ success: true, runs });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/projects/:id/app-generations/:runId */
export async function getAppGenerationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { project } = await authorizeProject(req, res);
    const run = await appGenerationService.getRun(project.id, String(req.params.runId));
    res.json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/projects/:id/app-generations/:runId/retry */
export async function retryAppGenerationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, project, tenantId } = await authorizeProject(req, res);
    const { run, created } = await appGenerationService.retryRun(project.id, String(req.params.runId), tenantId, user.id);
    res.status(created ? 202 : 200).json({ success: true, run });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/projects/:id/app-generation-templates */
export async function listAppGenerationTemplatesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeProject(req, res);
    const templates = Object.entries(APPROVED_TEMPLATES).map(([id, model]) => ({
      id,
      applicationName: model.applicationName,
      entities: model.entities.map((e) => e.name),
    }));
    res.json({ success: true, templates });
  } catch (err) {
    next(err);
  }
}
