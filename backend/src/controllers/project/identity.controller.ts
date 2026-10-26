/**
 * Project controller: Project Identity & Lifecycle.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { createForgeProject, getForgeProjectById, getOrCreateProjectForWebsite, updateForgeProject, transitionProjectLifecycle, listForgeProjects, cloneForgeProject } from "../../services/project/forgeProject.service.js";
import { prisma } from "../../config/prisma.js";
import { getAuthUser } from "./shared.js";

// Same alias as project.controller.ts: `prisma` is the shared client instance, so `db` is the same object.
const db = prisma as any;

// ---------------------------------------------------------------------------
// Project Identity & Lifecycle
// ---------------------------------------------------------------------------

export async function createProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await createForgeProject({
      ...req.body,
      ownerId: user.id,
    });
    res.status(201).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    if (project.websiteId) {
      const site = await db.website.findUnique({ where: { id: project.websiteId } });
      if (site) {
        const { syncProjectFromWebsite } = await import("../../services/project/forgeProject.service.js");
        const visualSync = await syncProjectFromWebsite(project, site, user);
        const fresh = (await db.forgeProject.findUnique({ where: { id: project.id } })) || project;
        return res.status(200).json({ success: true, project: { ...fresh, visualSync } });
      }
    }

    res.status(200).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

export async function getProjectByWebsiteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const websiteId = String(req.params.websiteId);
    const project = await getOrCreateProjectForWebsite(websiteId, user);
    res.status(200).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

export async function listProjectsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const filters = {
      workspaceId: req.query.workspaceId ? String(req.query.workspaceId) : undefined,
      organizationId: req.query.organizationId ? String(req.query.organizationId) : undefined,
      status: req.query.status as any,
      projectType: req.query.projectType as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      skip: req.query.skip ? Number(req.query.skip) : undefined,
    };
    const result = await listForgeProjects(user, filters);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const updated = await updateForgeProject(projectId, user, req.body);
    res.status(200).json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
}

export async function transitionLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const { status } = req.body;
    const updated = await transitionProjectLifecycle(projectId, status, user);
    res.status(200).json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
}

export async function cloneProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const cloned = await cloneForgeProject(projectId, user, req.body);
    res.status(201).json({ success: true, project: cloned });
  } catch (err) {
    next(err);
  }
}
