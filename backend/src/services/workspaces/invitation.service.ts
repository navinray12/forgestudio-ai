import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { workspaceCommand } from "./command.js";
import { requireActiveActor, requireOrganization, requireWorkspace, memberRole } from "./access.js";
import type { WorkspaceTransaction } from "./access.js";
import { assertWorkspaceWritable, assertWorkspaceVersion, expectedWorkspaceVersion } from "./lifecycle-policy.js";
const lifetimeMs = 7 * 24 * 60 * 60 * 1000;
const safeInvitation = { id: true, workspaceId: true, recipientUserId: true, invitedBy: true, role: true, status: true, version: true, expiresAt: true, acceptedAt: true, createdAt: true } as const;
async function setScope(tx: WorkspaceTransaction, organizationId: string) {
    await tx.$queryRaw `SELECT set_config('app.tenant_id',${organizationId},true)`;
}
async function verifiedRecipient(tx: WorkspaceTransaction, userId: string, organizationId: string) {
    await requireActiveActor(tx, userId);
    await requireOrganization(tx, organizationId, userId);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
    if (!user?.email || !user.emailVerified)
        throw new AppError("A verified email identity is required", 403, "VERIFIED_IDENTITY_REQUIRED");
}
async function manager(tx: WorkspaceTransaction, workspaceId: string, actorId: string, role?: string) {
    const context = await requireWorkspace(tx, workspaceId, actorId, true);
    if (role === "ADMIN" && context.membership.role !== "OWNER")
        throw new AppError("Only the owner can invite an administrator", 403, "FORBIDDEN");
    await setScope(tx, context.organization.id);
    return { ...context, organizationId: context.organization.id };
}
/** Invitations are recipient-bound in-app records, not bearer capabilities.
 * A copied invitation ID never grants access; no reusable secret is put in URLs,
 * journal responses or logs. External organization joining is a separate workflow.
 */
export async function inviteWorkspaceMember(actorId: string, workspaceId: string, recipientUserId: string, requestedRole: unknown, key: string) {
    const role = memberRole(requestedRole);
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_INVITATION_CREATED", payload: { workspaceId, recipientUserId, role },
        authorize: tx => manager(tx, workspaceId, actorId, role),
        execute: async (tx, context) => {
            assertWorkspaceWritable(context.workspace);
            await verifiedRecipient(tx, recipientUserId, context.organizationId);
            if (await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: recipientUserId } } }))
                throw new AppError("This user already has workspace access", 409, "MEMBERSHIP_EXISTS");
            if (await tx.workspaceInvitation.findFirst({ where: { workspaceId, recipientUserId, status: "PENDING" } }))
                throw new AppError("Renew or revoke the existing invitation", 409, "INVITATION_EXISTS");
            if (await tx.workspaceInvitation.count({ where: { workspaceId, status: "PENDING" } }) >= 200)
                throw new AppError("Pending invitation limit reached", 403, "INVITATION_LIMIT_EXCEEDED");
            const invitation = await tx.workspaceInvitation.create({ data: { id: randomUUID(), organizationId: context.organizationId, workspaceId, recipientUserId, invitedBy: actorId, role, expiresAt: new Date(Date.now() + lifetimeMs) }, select: safeInvitation });
            return { resourceId: workspaceId, invitation, delivery: "IN_APP" };
        } });
}
export async function listWorkspaceInvitations(actorId: string, workspaceId: string) {
    return prisma.$transaction(async (tx) => {
        await requireActiveActor(tx, actorId);
        await manager(tx, workspaceId, actorId);
        return tx.workspaceInvitation.findMany({ where: { workspaceId }, select: safeInvitation, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 });
    });
}
export async function listWorkspaceInvitationInbox(actorId: string) {
    return prisma.$transaction(async (tx) => {
        await requireActiveActor(tx, actorId);
        const memberships = await tx.organizationMember.findMany({ where: { userId: actorId }, select: { organizationId: true }, take: 100 });
        const invitations: Array<{
            id: string;
            workspaceId: string;
            recipientUserId: string;
            invitedBy: string;
            role: string;
            status: string;
            version: number;
            expiresAt: Date;
            acceptedAt: Date | null;
            createdAt: Date;
            workspaceName: string;
        }> = [];
        for (const membership of memberships) {
            await requireOrganization(tx, membership.organizationId, actorId);
            await setScope(tx, membership.organizationId);
            const rows = await tx.workspaceInvitation.findMany({ where: { organizationId: membership.organizationId, recipientUserId: actorId, status: "PENDING", expiresAt: { gt: new Date() } }, select: safeInvitation, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 - invitations.length });
            for (const row of rows) {
                const workspace = await tx.workspace.findUnique({ where: { id: row.workspaceId }, select: { name: true, lifecycleStatus: true } });
                if (workspace?.lifecycleStatus === "ACTIVE")
                    invitations.push({ ...row, workspaceName: workspace.name });
            }
            if (invitations.length >= 100)
                break;
        }
        return { invitations, limit: 100 };
    }, { maxWait: 2000, timeout: 5000 });
}
export async function acceptWorkspaceInvitation(actorId: string, workspaceId: string, invitationId: string, key: string) {
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_INVITATION_ACCEPTED", payload: { workspaceId, invitationId },
        authorize: async (tx) => {
            const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
            if (!workspace?.organizationId)
                throw new AppError("Invitation not found", 404, "NOT_FOUND");
            await verifiedRecipient(tx, actorId, workspace.organizationId);
            await setScope(tx, workspace.organizationId);
            const invitation = await tx.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId, organizationId: workspace.organizationId, recipientUserId: actorId } });
            if (!invitation)
                throw new AppError("Invitation not found", 404, "NOT_FOUND");
            return { organizationId: workspace.organizationId, workspace, invitation };
        },
        authorizeReplay: async (tx) => { await requireWorkspace(tx, workspaceId, actorId); },
        execute: async (tx, context) => {
            assertWorkspaceWritable(context.workspace);
            const invitation = context.invitation;
            if (invitation.status !== "PENDING" || invitation.expiresAt.getTime() <= Date.now())
                throw new AppError("Invitation is expired or no longer pending", 409, "INVITATION_UNAVAILABLE");
            // The inviter must still have current authority for this particular role.
            await manager(tx, workspaceId, invitation.invitedBy, invitation.role);
            await requireActiveActor(tx, invitation.invitedBy);
            if (await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: actorId } } }))
                throw new AppError("Workspace access already exists", 409, "MEMBERSHIP_EXISTS");
            await tx.workspaceMember.create({ data: { workspaceId, userId: actorId, role: memberRole(invitation.role) } });
            await tx.workspaceInvitation.update({ where: { id: invitationId }, data: { status: "ACCEPTED", acceptedAt: new Date(), version: { increment: 1 }, updatedAt: new Date() } });
            await tx.workspace.update({ where: { id: workspaceId }, data: { version: { increment: 1 } } });
            return { resourceId: workspaceId, invitationId, accepted: true };
        } });
}
export async function updateWorkspaceInvitation(actorId: string, workspaceId: string, invitationId: string, action: "REVOKE" | "RENEW", version: number, key: string) {
    expectedWorkspaceVersion(version);
    if (!["REVOKE", "RENEW"].includes(action))
        throw new AppError("Invalid invitation action", 400, "VALIDATION_ERROR");
    return workspaceCommand({ actorId, key, operation: `WORKSPACE_INVITATION_${action}`, payload: { workspaceId, invitationId, action, version },
        authorize: tx => manager(tx, workspaceId, actorId),
        execute: async (tx, context) => {
            const invitation = await tx.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId, organizationId: context.organizationId } });
            if (!invitation)
                throw new AppError("Invitation not found", 404, "NOT_FOUND");
            assertWorkspaceVersion(invitation.version, version);
            if (invitation.status !== "PENDING")
                throw new AppError("Invitation is no longer pending", 409, "INVITATION_UNAVAILABLE");
            if (action === "RENEW") {
                assertWorkspaceWritable(context.workspace);
                await manager(tx, workspaceId, actorId, invitation.role);
                await verifiedRecipient(tx, invitation.recipientUserId, context.organizationId);
            }
            const updated = await tx.workspaceInvitation.update({ where: { id: invitationId }, data: {
                    status: action === "REVOKE" ? "REVOKED" : "PENDING", version: { increment: 1 }, updatedAt: new Date(),
                    ...(action === "RENEW" ? { expiresAt: new Date(Date.now() + lifetimeMs), invitedBy: actorId } : {})
                }, select: safeInvitation });
            return { resourceId: workspaceId, invitation: updated };
        } });
}
