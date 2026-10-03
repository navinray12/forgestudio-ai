import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { getWebsiteById } from "./website.service.js";
import { effectiveCapability } from "./permissions/effective-capability.js";
import { isKnownCapability, relatedCapabilities } from "./permissions/capabilities.js";
export { DEFAULT_CAPABILITIES } from "./permissions/capabilities.js";

export async function canUserAccessResource(
  userId: string, websiteId: string, resourceId: string, capability: string
): Promise<boolean> {
  if (!userId || !websiteId || !resourceId || !isKnownCapability(capability)) return false;
  try {
    const website = await getWebsiteById(websiteId, userId);
    if (website.workspaceStatus === "ARCHIVED" && capability !== "VIEW") return false;
    const role = website.userPermission || "REVIEWER";
    const overrides = await prisma.granularPermission.findMany({
      where: {
        websiteId, userId,
        resourceId: { in: resourceId === "*" ? ["*"] : ["*", resourceId] },
        capability: { in: relatedCapabilities(capability) },
      },
    });
    // An explicit deny (or unknown persisted effect) cannot be widened by a
    // narrower ALLOW, an owner shortcut or a legacy capability alias.
    return effectiveCapability({ role, archived: website.workspaceStatus === "ARCHIVED", resourceId, capability, overrides });
  } catch {
    // Includes unavailable/missing permission tables: never fall through to
    // role defaults when the authoritative override state is unknown.
    return false;
  }
}

export async function authorizeResourceAccess(
  userId: string, websiteId: string, resourceId: string, capability: string
) {
  if (!(await canUserAccessResource(userId, websiteId, resourceId, capability))) {
    throw new AppError(`You do not have permission to ${capability} this resource.`, 403, "FORBIDDEN");
  }
}

export function authorizeCapability(capability: string, resourceId: string = "*") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = res.locals.user;
      if (!user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
      const websiteId = req.params.id || req.params.websiteId || req.body?.websiteId || req.query?.websiteId;
      if (typeof websiteId !== "string" || !websiteId) {
        throw new AppError("A website identifier is required", 400, "WEBSITE_SCOPE_REQUIRED");
      }
      await authorizeResourceAccess(user.id, websiteId, resourceId, capability);
      next();
    } catch (error) { next(error); }
  };
}

export async function getGranularPermissions(websiteId: string, requesterUserId: string) {
  await authorizeResourceAccess(requesterUserId, websiteId, "*", "MANAGE_PERMISSIONS");
  return prisma.granularPermission.findMany({
    where: { websiteId },
    include: { user: { select: { fullName: true, email: true } } },
  });
}

export async function setGranularPermission(
  websiteId: string, requesterUserId: string, targetUserId: string,
  resourceId: string, capability: string, effect: string
) {
  if (!["ALLOW", "DENY", "INHERIT"].includes(effect) || !isKnownCapability(capability)) {
    throw new AppError("Invalid permission capability or effect", 400, "BAD_REQUEST");
  }
  if (typeof resourceId !== "string" || !resourceId.trim() || resourceId.length > 100) {
    throw new AppError("Invalid resource identifier", 400, "BAD_REQUEST");
  }
  await authorizeResourceAccess(requesterUserId, websiteId, "*", "MANAGE_PERMISSIONS");
  if (effect === "ALLOW") {
    // Permission-management authority is not authority to grant any action.
    await authorizeResourceAccess(requesterUserId, websiteId, resourceId, capability);
  }

  return prisma.$transaction(async (tx) => {
    const website = await tx.website.findUnique({ where: { id: websiteId }, select: { userId: true } });
    if (!website) throw new AppError("Website not found", 404, "NOT_FOUND");
    if (website.userId === targetUserId) {
      throw new AppError("Cannot restrict project owner", 403, "FORBIDDEN");
    }
    const membership = await tx.websiteCollaborator.findUnique({
      where: { websiteId_userId: { websiteId, userId: targetUserId } },
    });
    if (!membership) throw new AppError("Target user is not a project member", 400, "BAD_REQUEST");
    const key = { websiteId, userId: targetUserId, resourceId, capability };
    let permission;
    if (effect === "INHERIT") {
      await tx.granularPermission.deleteMany({ where: key });
    } else {
      permission = await tx.granularPermission.upsert({
        where: { websiteId_userId_resourceId_capability: key },
        update: { effect }, create: { ...key, effect },
      });
    }
    // A failed mandatory audit aborts the same transaction as the mutation.
    await tx.auditLog.create({
      data: {
        userId: requesterUserId,
        action: effect === "INHERIT" ? "PERMISSION_DELETED" : "PERMISSION_UPDATED",
        targetResource: `website:${websiteId}`,
        details: { targetUserId, resourceId, capability, effect },
      },
    });
    return effect === "INHERIT" ? { success: true } : { success: true, permission };
  });
}
