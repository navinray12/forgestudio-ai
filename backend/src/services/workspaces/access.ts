import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../utils/app-error.js";

export type WorkspaceTransaction = Prisma.TransactionClient;
export const managerRoles = new Set(["OWNER", "ADMIN"]);
const memberRoles = new Set(["OWNER", "ADMIN", "MEMBER"]);

export function boundedName(value: unknown, label = "Name"): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new AppError(`${label} must contain 1 to 100 characters`, 400, "INVALID_NAME");
  }
  return value.trim();
}

export function memberRole(value: unknown): "ADMIN" | "MEMBER" {
  if (value !== "ADMIN" && value !== "MEMBER") throw new AppError("Invalid member role", 400, "INVALID_ROLE");
  return value;
}

export async function requireActiveActor(tx: WorkspaceTransaction, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { id: true, status: true } });
  if (!actor || actor.status !== "ACTIVE") throw new AppError("Account is not active", 403, "ACCOUNT_INACTIVE");
}

export async function requireOrganization(tx: WorkspaceTransaction, organizationId: string, actorId: string) {
  const organization = await tx.organization.findUnique({ where: { id: organizationId } });
  const membership = await tx.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: actorId } },
  });
  if (!organization || !membership || !memberRoles.has(membership.role) ||
      (membership.role === "OWNER" && organization.ownerId !== actorId)) {
    throw new AppError("Organization not found or access denied", 404, "NOT_FOUND");
  }
  return { organization, membership };
}

export async function requireWorkspace(tx: WorkspaceTransaction, workspaceId: string, actorId: string, manage = false) {
  const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
  const membership = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: actorId } } });
  if (!workspace || !membership || !memberRoles.has(membership.role) ||
      (membership.role === "OWNER" && workspace.ownerId !== actorId)) {
    throw new AppError("Workspace not found or access denied", 404, "NOT_FOUND");
  }
  if (!workspace.organizationId) {
    throw new AppError("Legacy workspace ownership requires migration", 409, "WORKSPACE_MIGRATION_REQUIRED");
  }
  const organizationContext = await requireOrganization(tx, workspace.organizationId, actorId);
  if (manage && !managerRoles.has(membership.role)) throw new AppError("Workspace management is not permitted", 403, "FORBIDDEN");
  return { workspace, membership, organization: organizationContext.organization, organizationMembership: organizationContext.membership };
}
