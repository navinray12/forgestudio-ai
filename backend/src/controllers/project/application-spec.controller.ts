/**
 * Project controller: v2.1 §33: Durable ApplicationSpec endpoints.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { AppError } from "../../utils/app-error.js";
import { getAuthUser } from "./shared.js";

/**
 * v2.1 §33: Durable ApplicationSpec endpoints on the existing project authority.
 * The project lookup enforces membership on reads; writes require owner/admin.
 * No browser-provided project or tenant scope is trusted.
 */
export async function commitProjectApplicationSpecHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    const privileged = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role || "");
    if (project.ownerId !== user.id && !privileged) {
      throw new AppError("Only the project owner or platform administrator can revise its application contract", 403, "FORBIDDEN");
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AppError("ApplicationSpec object is required", 400, "INVALID_APPLICATION_SPEC");
    }
    const trustedTenantId = project.organizationId || project.workspaceId || project.ownerId;
    if (body.projectId !== projectId || body.tenantId !== trustedTenantId) {
      throw new AppError("ApplicationSpec project or tenant does not match its authoritative project", 403, "INVALID_PROJECT_SCOPE");
    }
    const { ApplicationSpecService } = await import("../../services/authoritative/applicationSpec.service.js");
    const committed = await ApplicationSpecService.commitRevisionPersisted(body);
    res.status(201).json({
      success: committed.success,
      applicationId: committed.spec.applicationId,
      revision: committed.revision,
      digest: committed.digest,
      spec: committed.spec,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProjectApplicationSpecHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    const applicationId = String(req.params.applicationId || "");
    if (!applicationId || applicationId.length > 120) {
      throw new AppError("Invalid application ID", 400, "INVALID_APPLICATION_ID");
    }
    const trustedTenantId = project.organizationId || project.workspaceId || project.ownerId;
    const { ApplicationSpecService } = await import("../../services/authoritative/applicationSpec.service.js");
    const spec = await ApplicationSpecService.getLatestSpecPersisted(applicationId, projectId, trustedTenantId);
    if (!spec) throw new AppError("ApplicationSpec not found", 404, "NOT_FOUND");
    res.status(200).json({
      success: true,
      applicationId: spec.applicationId,
      revision: spec.revision,
      digest: ApplicationSpecService.computeDigest(spec),
      spec,
    });
  } catch (err) {
    next(err);
  }
}
