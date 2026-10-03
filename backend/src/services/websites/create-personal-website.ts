import { documentObject, preservePublishingAuthority, validateDocumentTree } from "./document-policy.js";
import { randomUUID } from "crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { requireSubscriptionAccess } from "../billing/subscription-policy.js";
import { boundedName, requireActiveActor, requireWorkspace } from "../workspaces/access.js";

type Input = { userId: string; name: string; slug?: string; editorData?: Prisma.InputJsonObject };

/** Compatibility creation path. All new personal sites have an organization and
 * workspace. The quota read and insert share a serializable transaction with the
 * workspace-specific API, so concurrent paths cannot consume one slot twice.
 */
export async function createPersonalWebsite(input: Input) {
  const name = boundedName(input.name, "Website name");
  const editorData = input.editorData === undefined ? {version: 1, elements: []} : preservePublishingAuthority({}, documentObject(input.editorData));
  validateDocumentTree(editorData);
  const slug = input.slug ?? `website-${randomUUID()}`;
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) throw new AppError("Invalid website slug", 400, "INVALID_SLUG");
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await requireActiveActor(tx, input.userId);
        const subscription = await tx.userSubscription.findUnique({ where: { userId: input.userId }, include: { plan: true } });
        if (!subscription) throw new AppError("Subscription provisioning is incomplete", 503, "SUBSCRIPTION_NOT_PROVISIONED");
        const limit = requireSubscriptionAccess(subscription);
        if (await tx.website.count({ where: { userId: input.userId } }) >= limit) {
          throw new AppError("Your website limit has been reached", 403, "WEBSITE_LIMIT_EXCEEDED");
        }
        const organizationSlug = `personal-${input.userId}`;
        let organization = await tx.organization.findUnique({ where: { slug: organizationSlug } });
        if (!organization) organization = await tx.organization.create({ data: {
          name: "Personal organization", slug: organizationSlug, ownerId: input.userId, settings: { kind: "PERSONAL" },
          members: { create: { userId: input.userId, role: "OWNER" } },
        } });
        if (organization.ownerId !== input.userId) throw new AppError("Personal organization ownership is invalid", 409, "OWNERSHIP_CONFLICT");
        const workspaceSlug = `personal-default-${input.userId}`;
        let workspace = await tx.workspace.findUnique({ where: { slug: workspaceSlug } });
        if (!workspace) workspace = await tx.workspace.create({ data: {
          name: "Personal websites", slug: workspaceSlug, ownerId: input.userId, organizationId: organization.id,
          members: { create: { userId: input.userId, role: "OWNER" } },
        } });
        if (workspace.organizationId !== organization.id || workspace.ownerId !== input.userId) {
          throw new AppError("Personal workspace ownership is invalid", 409, "OWNERSHIP_CONFLICT");
        }
        await requireWorkspace(tx, workspace.id, input.userId, true);
        const website = await tx.website.create({ data: {
          userId: input.userId, organizationId: organization.id, workspaceId: workspace.id,
          name, slug, status: "DRAFT", editorData: editorData as Prisma.InputJsonObject,
        } });
        await tx.auditLog.create({ data: {
          userId: input.userId, action: "PERSONAL_WEBSITE_CREATED", targetResource: `website:${website.id}`,
          details: { organizationId: organization.id, workspaceId: workspace.id },
        } });
        return website;
      }, { isolationLevel: "Serializable", maxWait: 2000, timeout: 5000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
      if (code === "P2034" || code === "P2002") throw new AppError("Concurrent creation conflict; retry safely", 409, "CONCURRENT_CHANGE");
      throw error;
    }
  }
}
