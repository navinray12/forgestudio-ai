import type { Request } from "express";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

const DATABASE_ENVIRONMENTS = new Set<DatabaseEnvironment>(["DEVELOPMENT", "PREVIEW", "PRODUCTION"]);
const ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

export interface ProjectAccess {
  website: { id: string; userId: string };
  /** Tenant that owns the website, derived server-side: workspace, else organization, else owner. */
  tenantId: string;
  /** Owner, or an OWNER/ADMIN collaborator/team/workspace/organization member. */
  canAdminister: boolean;
}

/**
 * Resolves the caller's access to a project's databases. Any collaborator or member may
 * read; only owners and admins may perform destructive operations against PRODUCTION.
 */
export async function verifyProjectAccess(websiteId: string, userId: string): Promise<ProjectAccess> {
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      OR: [
        { userId },
        { collaborators: { some: { userId } } },
        { team: { members: { some: { userId } } } },
        { workspace: { members: { some: { userId } } } },
        { organization: { members: { some: { userId } } } },
      ],
    },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      organizationId: true,
      collaborators: { where: { userId }, select: { permission: true } },
      team: { select: { members: { where: { userId }, select: { role: true } } } },
      workspace: { select: { members: { where: { userId }, select: { role: true } } } },
      organization: { select: { members: { where: { userId }, select: { role: true } } } },
    },
  });

  if (!website) {
    throw new AppError("Project not found or access denied", 404, "NOT_FOUND");
  }

  const roles = [
    ...website.collaborators.map((c) => c.permission),
    ...(website.team?.members ?? []).map((m) => m.role),
    ...(website.workspace?.members ?? []).map((m) => m.role),
    ...(website.organization?.members ?? []).map((m) => m.role),
  ].map((r) => String(r).toUpperCase());

  return {
    website: { id: website.id, userId: website.userId },
    tenantId: website.workspaceId || website.organizationId || website.userId,
    canAdminister: website.userId === userId || roles.some((r) => ADMIN_ROLES.has(r)),
  };
}

/**
 * Reads the target database environment from the query string or body. There is no
 * default: a missing or unknown value is rejected before any database is touched, so a
 * request can never fall through to PRODUCTION by omission.
 */
export function resolveExplicitEnvironment(req: Request): DatabaseEnvironment {
  const raw = (req.query.environment as string | undefined) ?? (req.body?.environment as string | undefined);
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new AppError(
      "An explicit environment is required (DEVELOPMENT, PREVIEW or PRODUCTION)",
      400,
      "ENVIRONMENT_REQUIRED"
    );
  }
  const upper = raw.trim().toUpperCase() as DatabaseEnvironment;
  if (!DATABASE_ENVIRONMENTS.has(upper)) {
    throw new AppError(`Unknown database environment "${raw}"`, 400, "UNKNOWN_ENVIRONMENT");
  }
  return upper;
}

/** Rejects a destructive PRODUCTION operation unless the caller administers the project. */
export function assertCanModify(environment: DatabaseEnvironment, access: ProjectAccess, action: string): void {
  if (environment === "PRODUCTION" && !access.canAdminister) {
    throw new AppError(
      `Only project owners and admins can ${action} in the PRODUCTION database`,
      403,
      "PRODUCTION_WRITE_FORBIDDEN"
    );
  }
}
