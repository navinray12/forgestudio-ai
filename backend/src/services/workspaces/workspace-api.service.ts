import { assertWorkspaceWritable, publicWorkspaceSettings } from "./lifecycle-policy.js";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { requireSubscriptionAccess } from "../billing/subscription-policy.js";
import { workspaceCommand } from "./command.js";
import { boundedName, managerRoles, memberRole, requireActiveActor, requireOrganization, requireWorkspace } from "./access.js";
import type { WorkspaceTransaction } from "./access.js";

export type WorkspaceCreated = {
  resourceId: string;
  workspace: { id: string; name: string; slug: string; organizationId: string | null; userRole: string };
};

const safeWebsiteFields = { id: true, name: true, slug: true, status: true, createdAt: true, updatedAt: true } as const;

async function creationScope(tx: WorkspaceTransaction, actorId: string, requestedOrganizationId?: string) {
  if (requestedOrganizationId) {
    const { organization, membership } = await requireOrganization(tx, requestedOrganizationId, actorId);
    if (!managerRoles.has(membership.role)) throw new AppError("Organization management permission is required", 403, "FORBIDDEN");
    return { organizationId: organization.id };
  }
  // Only an explicit create command provisions a personal organization. GET
  // requests do not create data. The unique slug makes concurrent setup converge.
  const slug = `personal-${actorId}`;
  let organization = await tx.organization.findUnique({ where: { slug } });
  if (!organization) {
    organization = await tx.organization.create({ data: {
      name: "Personal organization", slug, ownerId: actorId,
      settings: { kind: "PERSONAL" }, members: { create: { userId: actorId, role: "OWNER" } },
    } });
    await tx.auditLog.create({ data: { userId: actorId, action: "PERSONAL_ORGANIZATION_PROVISIONED", targetResource: `organization:${organization.id}` } });
  }
  if (organization.ownerId !== actorId) throw new AppError("Personal organization ownership is invalid", 409, "OWNERSHIP_CONFLICT");
  await requireOrganization(tx, organization.id, actorId);
  return { organizationId: organization.id };
}

export async function createTenantWorkspace(actorId: string, input: { name: string; organizationId?: string }, key: string) {
  const name = boundedName(input.name, "Workspace name");
  return workspaceCommand<{ organizationId: string }, WorkspaceCreated>({ actorId, key, operation: "WORKSPACE_CREATED", payload: { name, organizationId: input.organizationId ?? null },
    authorize: (tx) => creationScope(tx, actorId, input.organizationId),
    authorizeReplay: async (tx, result) => { await requireWorkspace(tx, result.resourceId, actorId); },
    execute: async (tx, context) => {
      if (await tx.workspace.count({ where: { organizationId: context.organizationId } }) >= 100) {
        throw new AppError("The organization workspace safety limit has been reached", 403, "WORKSPACE_LIMIT_EXCEEDED");
      }
      const workspace = await tx.workspace.create({ data: {
        name, slug: `workspace-${randomUUID()}`, ownerId: actorId, organizationId: context.organizationId,
        members: { create: { userId: actorId, role: "OWNER" } },
      }, select: { id: true, name: true, slug: true, organizationId: true } });
      return { resourceId: workspace.id, workspace: { ...workspace, userRole: "OWNER" } };
    },
  });
}

export async function listTenantWorkspaces(actorId: string) {
  return prisma.$transaction(async (tx) => {
    await requireActiveActor(tx, actorId);
    const rows = await tx.workspace.findMany({
      where: { members: { some: { userId: actorId } }, organization: { members: { some: { userId: actorId } } } },
      select: { id: true, name: true, slug: true, organizationId: true, ownerId: true, lifecycleStatus: true, version: true,
        organization: { select: { id: true, name: true, ownerId: true, members: { where: { userId: actorId }, select: { role: true } } } },
        members: { where: { userId: actorId }, select: { role: true } },
      }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 101,
    });
    const permitted = rows.filter((row) => {
      const role = row.members[0]?.role; const orgRole = row.organization?.members[0]?.role;
      return ["OWNER", "ADMIN", "MEMBER"].includes(role || "") && ["OWNER", "ADMIN", "MEMBER"].includes(orgRole || "") &&
        (role !== "OWNER" || row.ownerId === actorId) && (orgRole !== "OWNER" || row.organization?.ownerId === actorId);
    });
    return { workspaces: permitted.slice(0,100).map((row) => ({
      id: row.id, name: row.name, slug: row.slug, organizationId: row.organizationId,
      organizationName: row.organization?.name, userRole: row.members[0]!.role, lifecycleStatus: row.lifecycleStatus, version: row.version,
    })), hasMore: rows.length > 100 };
  });
}

export async function readTenantWorkspace(actorId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    await requireActiveActor(tx, actorId);
    const { workspace, membership, organization } = await requireWorkspace(tx, workspaceId, actorId);
    const members = await tx.workspaceMember.findMany({
      where: { workspaceId }, take: 200, orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, role: true, user: { select: { fullName: true } } },
    });
    const websites = await tx.website.findMany({
      where: { workspaceId, organizationId: organization.id,
        granularPermissions: { none: { userId: actorId, resourceId: "*", capability: "VIEW", effect: { not: "ALLOW" } } },
      }, select: safeWebsiteFields, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101,
    });
    return { id: workspace.id, name: workspace.name, slug: workspace.slug, organizationId: organization.id,
      organizationName: organization.name, userRole: membership.role, members,
      lifecycleStatus: workspace.lifecycleStatus, version: workspace.version, archivedAt: workspace.archivedAt, settings: publicWorkspaceSettings(workspace.settings),
      websites: websites.slice(0,100), hasMoreWebsites: websites.length > 100,
    };
  });
}

export async function listEligibleWorkspaceMembers(actorId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    await requireActiveActor(tx, actorId);
    const { organization } = await requireWorkspace(tx, workspaceId, actorId, true);
    return tx.organizationMember.findMany({
      where: { organizationId: organization.id, user: { status: "ACTIVE" } }, take: 200,
      select: { userId: true, user: { select: { fullName: true } } }, orderBy: { createdAt: "asc" },
    });
  });
}

export async function addTenantWorkspaceMember(actorId: string, workspaceId: string, targetUserId: string, requestedRole: unknown, key: string) {
  const role = memberRole(requestedRole);
  return workspaceCommand({ actorId, key, operation: "WORKSPACE_MEMBER_ADDED", payload: { workspaceId, targetUserId, role },
    authorize: async (tx) => {
      const context = await requireWorkspace(tx, workspaceId, actorId, true);
      assertWorkspaceWritable(context.workspace);
      if (role === "ADMIN" && context.membership.role !== "OWNER") throw new AppError("Only the workspace owner can grant administrator access", 403, "FORBIDDEN");
      await requireActiveActor(tx, targetUserId);
      await requireOrganization(tx, context.organization.id, targetUserId);
      return { ...context, organizationId: context.organization.id };
    },
    execute: async (tx) => {
      const existing = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } });
      if (existing) throw new AppError("This user is already a workspace member", 409, "MEMBERSHIP_EXISTS");
      await tx.workspaceMember.create({ data: { workspaceId, userId: targetUserId, role } });
      await tx.workspace.update({where:{id:workspaceId},data:{version:{increment:1}}});
      return { resourceId: workspaceId, success: true };
    },
  });
}

export async function removeTenantWorkspaceMember(actorId: string, workspaceId: string, targetUserId: string, key: string) {
  return workspaceCommand({ actorId, key, operation: "WORKSPACE_MEMBER_REMOVED", payload: { workspaceId, targetUserId },
    authorize: async (tx) => {
      const context = await requireWorkspace(tx, workspaceId, actorId, true);
      if (context.workspace.ownerId === targetUserId) throw new AppError("The workspace owner cannot be removed", 403, "OWNER_TRANSFER_REQUIRED");
      const target = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } });
      if (target && target.role !== "MEMBER" && context.membership.role !== "OWNER" && actorId !== targetUserId) {
        throw new AppError("Only the workspace owner can remove another administrator", 403, "FORBIDDEN");
      }
      return { ...context, organizationId: context.organization.id };
    },
    execute: async (tx) => {
      await tx.workspaceMember.deleteMany({ where: { workspaceId, userId: targetUserId } });
      await tx.workspace.update({where:{id:workspaceId},data:{version:{increment:1}}});
      return { resourceId: workspaceId, success: true };
    },
  });
}

export async function createTenantWorkspaceWebsite(actorId: string, workspaceId: string, rawName: unknown, key: string) {
  const name = boundedName(rawName, "Website name");
  return workspaceCommand({ actorId, key, operation: "WORKSPACE_WEBSITE_CREATED", payload: { workspaceId, name },
    authorize: async (tx) => {
      const context = await requireWorkspace(tx, workspaceId, actorId, true);
      assertWorkspaceWritable(context.workspace);
      return { ...context, organizationId: context.organization.id };
    },
    execute: async (tx, context) => {
      const subscription = await tx.userSubscription.findUnique({ where: { userId: actorId }, include: { plan: true } });
      if (!subscription) throw new AppError("Subscription provisioning is incomplete", 503, "SUBSCRIPTION_NOT_PROVISIONED");
      const limit = requireSubscriptionAccess(subscription);
      const count = await tx.website.count({ where: { userId: actorId } });
      if (count >= limit) throw new AppError("Your website limit has been reached", 403, "WEBSITE_LIMIT_EXCEEDED");
      const website = await tx.website.create({ data: {
        userId: actorId, organizationId: context.organizationId, workspaceId,
        name, slug: `website-${randomUUID()}`, status: "DRAFT", editorData: { version: 1, elements: [] },
      }, select: safeWebsiteFields });
      return { resourceId: website.id, website };
    },
    authorizeReplay: async (tx, result) => {
      const website = await tx.website.findUnique({ where: { id: result.resourceId }, select: { workspaceId: true, organizationId: true } });
      const context = await requireWorkspace(tx, workspaceId, actorId, true);
      if (!website || website.workspaceId !== workspaceId || website.organizationId !== context.organization.id) {
        throw new AppError("The original result is no longer in this workspace", 409, "RESULT_SCOPE_CHANGED");
      }
    },
  });
}
