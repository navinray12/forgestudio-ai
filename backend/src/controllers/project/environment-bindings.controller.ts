/**
 * Project controller: Blueprint Point 42: Environment Bindings, Secrets and Isolation.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { environmentBindingService, requireEnvironmentClass, toPublicBinding } from "../../services/environment/environmentBinding.service.js";
import { recordAuditLog } from "../../services/audit.service.js";
import { FRESH_AUTH_WINDOW_MS } from "../../services/cms/contentLifecycle.service.js";
import { targetResolutionService } from "../../services/environment/targetResolution.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Blueprint Point 42: Environment Bindings, Secrets and Isolation
// ---------------------------------------------------------------------------

/** Same window the identity module and purge approvals use for a "fresh" sign-in. */
const BINDING_STEP_UP_WINDOW_MS = FRESH_AUTH_WINDOW_MS;

/**
 * Binding changes are limited to the project owner, platform administrators and OWNER/ADMIN members
 * of the project's workspace. Membership is always read from the database for the session user.
 */
async function assertCanAdministerBindings(project: { ownerId: string; workspaceId?: string | null }, user: { id: string; role?: string }) {
  if (["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role || "") || project.ownerId === user.id) return;
  if (project.workspaceId) {
    const member = await (prisma as any).workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: user.id } },
    });
    if (member && ["OWNER", "ADMIN"].includes(String(member.role).toUpperCase())) return;
  }
  throw new AppError("Only project owners and workspace admins can change environment bindings", 403, "FORBIDDEN");
}

/** Step-up is derived from the session's sign-in time; a client can never assert it. */
function hasRecentSignIn(res: Response): boolean {
  const authTime = res.locals.session?.authTime ? new Date(res.locals.session.authTime).getTime() : NaN;
  return Number.isFinite(authTime) && Date.now() - authTime <= BINDING_STEP_UP_WINDOW_MS;
}

export async function resolveEnvironmentBindingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const environment = req.query.environment || req.body?.environment;
    const binding = await environmentBindingService.getBinding(projectId, environment);

    res.status(200).json({ success: true, binding: toPublicBinding(binding) });
  } catch (err) {
    next(err);
  }
}

export async function listEnvironmentBindingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);
    const bindings = await environmentBindingService.listBindings(projectId);
    res.status(200).json({ success: true, bindings: bindings.map(toPublicBinding) });
  } catch (err) {
    next(err);
  }
}

export async function registerEnvironmentBindingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    await assertCanAdministerBindings(project, user);

    const environment = requireEnvironmentClass(req.params.environment);
    const { secretRef, provider, roles, applicationId, expectedVersion } = req.body ?? {};
    if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
      throw new AppError("expectedVersion must be a non-negative integer", 400, "INVALID_VERSION");
    }
    const binding = await environmentBindingService.registerBinding(
      projectId,
      typeof applicationId === "string" && applicationId ? applicationId : `app_${projectId}`,
      environment,
      { secretRef, provider, roles, expectedVersion, stepUpVerified: hasRecentSignIn(res), actorId: user.id }
    );
    await recordAuditLog({
      userId: user.id,
      action: "ENVIRONMENT_BINDING_REGISTERED",
      targetResource: `forge_project:${projectId}`,
      // The secret reference is deliberately not recorded; the fingerprint identifies the version.
      details: { environment, bindingId: binding.bindingId, version: binding.version, targetFingerprint: binding.targetFingerprint },
    });
    res.status(binding.version === 1 ? 201 : 200).json({ success: true, binding: toPublicBinding(binding) });
  } catch (err) {
    next(err);
  }
}

export async function retireEnvironmentBindingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    await assertCanAdministerBindings(project, user);

    const environment = requireEnvironmentClass(req.params.environment);
    const binding = await environmentBindingService.retireBinding(projectId, environment, {
      stepUpVerified: hasRecentSignIn(res),
      actorId: user.id,
    });
    await recordAuditLog({
      userId: user.id,
      action: "ENVIRONMENT_BINDING_RETIRED",
      targetResource: `forge_project:${projectId}`,
      details: { environment, bindingId: binding.bindingId, version: binding.version },
    });
    res.status(200).json({ success: true, binding: toPublicBinding(binding) });
  } catch (err) {
    next(err);
  }
}

export async function resolveTargetPoolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    // The environment must be named explicitly; there is no default destination.
    const { environment, roleType } = req.body ?? {};
    const pool = await targetResolutionService.resolveTargetPool(
      projectId,
      requireEnvironmentClass(environment),
      roleType || "runtime"
    );

    res.status(200).json({ success: true, pool });
  } catch (err) {
    next(err);
  }
}
