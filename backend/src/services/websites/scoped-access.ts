import type { WorkspaceTransaction } from "../workspaces/access.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { requireActiveActor } from "../workspaces/access.js";
import { DEFAULT_CAPABILITIES } from "../permissions/capabilities.js";

type Member = { role: string };
type AccessRecord = {
  userId: string; organizationId: string | null; workspaceId: string | null;
  organization: { ownerId: string; members: Member[] } | null;
  workspace: { ownerId: string; organizationId: string | null; lifecycleStatus?: string; members: Member[] } | null;
  collaborators: Array<{ permission: string }>;
  granularPermissions: Array<{ effect: string }>;
};
const workspaceRoles = new Set(["OWNER", "ADMIN", "MEMBER"]);

/** Creator attribution is not a way around current workspace membership.
 * Legacy unscoped sites retain their existing owner/collaborator contract until
 * the approved ownership backfill; new tenant sites use current parent scope.
 */
export function resolveWebsiteRole(website: AccessRecord, actorId: string): string | null {
  if (website.granularPermissions.some((grant) => grant.effect !== "ALLOW")) return null;
  if (website.organizationId) {
    const organization = website.organization;
    const role = organization?.members[0]?.role;
    if (!organization || !role || !workspaceRoles.has(role) || (role === "OWNER" && organization.ownerId !== actorId)) return null;
  }
  let inherited: string | null = null;
  if (website.workspaceId) {
    const workspace = website.workspace;
    const role = workspace?.members[0]?.role;
    if (!workspace || !website.organizationId || workspace.organizationId !== website.organizationId ||
        !role || !workspaceRoles.has(role) || (role === "OWNER" && workspace.ownerId !== actorId)) return null;
    inherited = role === "OWNER" ? "OWNER" : role === "ADMIN" ? "ADMIN" : "VIEWER";
  }
  if (website.workspace?.lifecycleStatus === "ARCHIVED") return "VIEWER";
  const explicit = website.collaborators[0]?.permission;
  if (explicit) {
    if (!Object.hasOwn(DEFAULT_CAPABILITIES, explicit)) return null;
    if (["OWNER", "PROJECT_OWNER"].includes(explicit)) return inherited === "OWNER" ? "OWNER" : null;
    return explicit;
  }
  if (inherited) return inherited;
  return website.userId === actorId ? "OWNER" : null;
}

function scopeRelations(actorId: string) {
  return {
    organization: { select: { ownerId: true, members: { where: { userId: actorId }, select: { role: true } } } },
    workspace: { select: { ownerId: true, organizationId: true, lifecycleStatus: true, members: { where: { userId: actorId }, select: { role: true } } } },
    collaborators: { where: { userId: actorId }, select: { permission: true } },
    granularPermissions: { where: { userId: actorId, resourceId: "*", capability: "VIEW" }, select: { effect: true } },
  } as const;
}

export async function getScopedWebsiteInTransaction(tx: WorkspaceTransaction, websiteId: string, actorId: string) {
    await requireActiveActor(tx, actorId);
    const row = await tx.website.findUnique({ where: { id: websiteId }, include: { ...scopeRelations(actorId), customCodeSnippets: true } });
    const role = row && resolveWebsiteRole(row, actorId);
    if (!row || !role) throw new AppError("Website not found or access denied", 404, "WEBSITE_NOT_FOUND");
    const { organization, workspace, collaborators, granularPermissions, ...website } = row;
    return { ...website, userPermission: role, workspaceStatus: workspace?.lifecycleStatus ?? "ACTIVE" };
}

export async function getScopedWebsite(websiteId: string, actorId: string) {
  return prisma.$transaction(tx => getScopedWebsiteInTransaction(tx, websiteId, actorId));
}

export async function listScopedOwnedWebsites(actorId: string) {
  return prisma.$transaction(async (tx) => {
    await requireActiveActor(tx, actorId);
    const rows = await tx.website.findMany({
      where: { userId: actorId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
      select: {
        id: true, userId: true, organizationId: true, workspaceId: true,
        name: true, slug: true, status: true, createdAt: true, updatedAt: true,
        ...scopeRelations(actorId),
        wpConnection: { select: { id: true, siteUrl: true, wpSiteName: true, status: true, lastVerifiedAt: true, createdAt: true } },
      },
    });
    return rows.flatMap((row) => {
      const role = resolveWebsiteRole(row, actorId);
      if (!role) return [];
      const { organization, workspace, collaborators, granularPermissions, ...website } = row;
      return [{ ...website, userPermission: role }];
    });
  });
}

/** Presence reveals collaborators, so it uses the same view boundary as document reads. */
export async function canReadWebsitePresence(websiteId: string, actorId: string): Promise<boolean> {
  return prisma.$transaction(async tx => {
    await requireActiveActor(tx, actorId);
    const row = await tx.website.findUnique({ where: { id: websiteId },
      select: { userId: true, organizationId: true, workspaceId: true, ...scopeRelations(actorId) } });
    return !!row && resolveWebsiteRole(row, actorId) !== null;
  });
}
