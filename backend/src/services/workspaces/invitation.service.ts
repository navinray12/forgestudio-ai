import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { workspaceCommand } from "./command.js";
import { requireActiveActor, requireWorkspace, memberRole } from "./access.js";
import type { WorkspaceTransaction } from "./access.js";
import { assertWorkspaceWritable, assertWorkspaceVersion, expectedWorkspaceVersion } from "./lifecycle-policy.js";
import { invitationEmail, invitationToken, invitationTokenHash, invitationLink, matchesInvitationToken } from "./invitation-token.js";
import { assertSmtpConfigured } from "../../adapters/identity/smtp-delivery.js";

const lifetimeMs = 7 * 24 * 60 * 60 * 1000;
const safeInvitation = { id: true, workspaceId: true, recipientUserId: true, invitedEmail: true, invitedBy: true,
    role: true, status: true, version: true, expiresAt: true, acceptedAt: true, createdAt: true,
    emailStatus: true, emailQueuedAt: true, emailSentAt: true } as const;
async function setScope(tx: WorkspaceTransaction, organizationId: string) {
    await tx.$queryRaw`SELECT set_config('app.tenant_id',${organizationId},true)`;
}
async function verifiedRecipient(tx: WorkspaceTransaction, userId: string) {
    await requireActiveActor(tx, userId);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
    if (!user?.email || !user.emailVerified)
        throw new AppError("A verified email identity is required", 403, "VERIFIED_IDENTITY_REQUIRED");
    return invitationEmail(user.email);
}
async function manager(tx: WorkspaceTransaction, workspaceId: string, actorId: string, role?: string) {
    const context = await requireWorkspace(tx, workspaceId, actorId, true);
    if (role === "ADMIN" && context.membership.role !== "OWNER")
        throw new AppError("Only the owner can invite an administrator", 403, "FORBIDDEN");
    await setScope(tx, context.organization.id);
    return { ...context, organizationId: context.organization.id };
}
async function queueEmail(tx: WorkspaceTransaction, invitation: { id: string; version: number; organizationId: string }, actorId: string) {
    const recent = await tx.workspaceOutbox.count({ where: { organizationId: invitation.organizationId, actorId,
        operation: "WORKSPACE_INVITATION_EMAIL", createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
    if (recent >= 100) throw new AppError("Invitation email limit reached; try later", 429, "INVITATION_EMAIL_LIMIT");
    // Non-secret identifiers only. This is committed with the invitation, audit and journal.
    await tx.workspaceOutbox.create({ data: { organizationId: invitation.organizationId, actorId,
        operation: "WORKSPACE_INVITATION_EMAIL", resourceId: invitation.id,
        payload: { invitationId: invitation.id, version: invitation.version } } });
}
function emailProof(id: string, version: number) {
    assertSmtpConfigured();
    const token = invitationToken(id, version);
    invitationLink(id, token); // Validate the configured browser origin before accepting work.
    return invitationTokenHash(token);
}
export async function inviteWorkspaceMember(actorId: string, workspaceId: string, recipientUserId: string, requestedRole: unknown, key: string) {
    return createInvitation(actorId, workspaceId, { userId: recipientUserId }, requestedRole, key);
}
export async function inviteWorkspaceMemberByEmail(actorId: string, workspaceId: string, email: unknown, requestedRole: unknown, key: string) {
    return createInvitation(actorId, workspaceId, { email: invitationEmail(email) }, requestedRole, key);
}
async function createInvitation(actorId: string, workspaceId: string, target: { userId: string } | { email: string }, requestedRole: unknown, key: string) {
    const role = memberRole(requestedRole);
    const emailBased = "email" in target;
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_INVITATION_CREATED", payload: { workspaceId, ...target, role },
        authorize: tx => manager(tx, workspaceId, actorId, role),
        execute: async (tx, context) => {
            assertWorkspaceWritable(context.workspace);
            let recipientUserId: string | null;
            let email: string;
            if ("email" in target) {
                email = target.email;
                const users = await tx.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true }, take: 2 });
                // Historical case-variant identities must be resolved, never guessed.
                if (users.length > 1) throw new AppError("Recipient identity requires review", 409, "RECIPIENT_AMBIGUOUS");
                recipientUserId = users[0]?.id ?? null;
            } else {
                recipientUserId = target.userId;
                email = await verifiedRecipient(tx, recipientUserId);
                await requireActiveActor(tx, actorId); // Keep authorization context on the manager.
                await setScope(tx, context.organizationId);
            }
            if (recipientUserId && await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: recipientUserId } } }))
                throw new AppError("This user already has workspace access", 409, "MEMBERSHIP_EXISTS");
            if (await tx.workspaceInvitation.findFirst({ where: { workspaceId, status: "PENDING", OR: [
                { invitedEmail: email }, ...(recipientUserId ? [{ recipientUserId }] : []) ] } }))
                throw new AppError("Renew or revoke the existing invitation", 409, "INVITATION_EXISTS");
            if (await tx.workspaceInvitation.count({ where: { workspaceId, status: "PENDING" } }) >= 200)
                throw new AppError("Pending invitation limit reached", 403, "INVITATION_LIMIT_EXCEEDED");
            const id = randomUUID();
            const invitation = await tx.workspaceInvitation.create({ data: { id, organizationId: context.organizationId, workspaceId,
                recipientUserId, invitedEmail: email, invitedBy: actorId, role, expiresAt: new Date(Date.now() + lifetimeMs),
                ...(emailBased ? { tokenHash: emailProof(id, 1), emailStatus: "QUEUED", emailQueuedAt: new Date() } : {}) }, select: safeInvitation });
            if (emailBased) await queueEmail(tx, { ...invitation, organizationId: context.organizationId }, actorId);
            return { resourceId: workspaceId, invitation, delivery: emailBased ? "QUEUED" : "IN_APP" };
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
        const email = await verifiedRecipient(tx, actorId);
        const rows = await tx.workspaceInvitation.findMany({
            where: { OR: [{ recipientUserId: actorId }, { invitedEmail: email }], status: "PENDING", expiresAt: { gt: new Date() } },
            select: safeInvitation, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
        });
        const invitations = [];
        for (const row of rows) {
            const workspace = await tx.workspace.findUnique({ where: { id: row.workspaceId }, select: { name: true, lifecycleStatus: true } });
            if (workspace?.lifecycleStatus === "ACTIVE") invitations.push({ ...row, workspaceName: workspace.name });
        }
        return { invitations, limit: 100 };
    }, { maxWait: 2000, timeout: 5000 });
}
async function recipientInvitation(tx: WorkspaceTransaction, actorId: string, invitationId: string, token?: string, workspaceId?: string) {
    const email = await verifiedRecipient(tx, actorId);
    const invitation = await tx.workspaceInvitation.findFirst({ where: { id: invitationId, ...(workspaceId ? { workspaceId } : {}),
        OR: [{ recipientUserId: actorId }, { invitedEmail: email }] } });
    if (!invitation || (invitation.invitedEmail && invitation.invitedEmail !== email) ||
        (invitation.recipientUserId && invitation.recipientUserId !== actorId) ||
        (invitation.tokenHash && !matchesInvitationToken(token, invitation.tokenHash)))
        throw new AppError("Invitation not found or unavailable for this account", 404, "NOT_FOUND");
    return invitation;
}
export async function resolveWorkspaceInvitation(actorId: string, invitationId: string, token: string) {
    return prisma.$transaction(async tx => {
        const invitation = await recipientInvitation(tx, actorId, invitationId, token);
        if (!invitation.tokenHash || invitation.status !== "PENDING" || invitation.expiresAt.getTime() <= Date.now())
            throw new AppError("Invitation is expired or no longer pending", 409, "INVITATION_UNAVAILABLE");
        const workspace = await tx.workspace.findUnique({ where: { id: invitation.workspaceId }, select: { name: true, lifecycleStatus: true } });
        if (!workspace || workspace.lifecycleStatus !== "ACTIVE") throw new AppError("Invitation is unavailable", 409, "INVITATION_UNAVAILABLE");
        return { invitation: { id: invitation.id, workspaceId: invitation.workspaceId, workspaceName: workspace.name,
            role: invitation.role, expiresAt: invitation.expiresAt } };
    });
}
export async function acceptWorkspaceInvitation(actorId: string, workspaceId: string, invitationId: string, key: string, token?: string) {
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_INVITATION_ACCEPTED",
        payload: { workspaceId, invitationId, ...(token ? { proofHash: invitationTokenHash(token) } : {}) },
        authorize: async tx => {
            const invitation = await recipientInvitation(tx, actorId, invitationId, token, workspaceId);
            await setScope(tx, invitation.organizationId);
            return { organizationId: invitation.organizationId, invitation };
        },
        authorizeReplay: async tx => { await requireWorkspace(tx, workspaceId, actorId); },
        execute: async (tx, context) => {
            const invitation = context.invitation;
            if (invitation.status !== "PENDING" || invitation.expiresAt.getTime() <= Date.now())
                throw new AppError("Invitation is expired or no longer pending", 409, "INVITATION_UNAVAILABLE");
            // Revalidate current authority, then perform writes under that manager's
            // RLS context. No grant escapes if any later check or audit fails.
            await requireActiveActor(tx, invitation.invitedBy);
            const managed = await manager(tx, workspaceId, invitation.invitedBy, invitation.role);
            assertWorkspaceWritable(managed.workspace);
            if (await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: actorId } } }))
                throw new AppError("Workspace access already exists", 409, "MEMBERSHIP_EXISTS");
            await tx.organizationMember.upsert({ where: { organizationId_userId: { organizationId: context.organizationId, userId: actorId } },
                create: { organizationId: context.organizationId, userId: actorId, role: "MEMBER" }, update: {} });
            await tx.workspaceMember.create({ data: { workspaceId, userId: actorId, role: memberRole(invitation.role) } });
            await tx.workspaceInvitation.update({ where: { id: invitationId }, data: { recipientUserId: actorId,
                status: "ACCEPTED", acceptedAt: new Date(), version: { increment: 1 }, updatedAt: new Date() } });
            await requireActiveActor(tx, actorId);
            await tx.workspace.update({ where: { id: workspaceId }, data: { version: { increment: 1 } } });
            return { resourceId: workspaceId, invitationId, accepted: true };
        } });
}
export async function updateWorkspaceInvitation(actorId: string, workspaceId: string, invitationId: string, action: "REVOKE" | "RENEW", version: number, key: string) {
    expectedWorkspaceVersion(version);
    if (!["REVOKE", "RENEW"].includes(action)) throw new AppError("Invalid invitation action", 400, "VALIDATION_ERROR");
    return workspaceCommand({ actorId, key, operation: `WORKSPACE_INVITATION_${action}`, payload: { workspaceId, invitationId, action, version },
        authorize: tx => manager(tx, workspaceId, actorId),
        execute: async (tx, context) => {
            const invitation = await tx.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId, organizationId: context.organizationId } });
            if (!invitation) throw new AppError("Invitation not found", 404, "NOT_FOUND");
            assertWorkspaceVersion(invitation.version, version);
            if (invitation.status !== "PENDING") throw new AppError("Invitation is no longer pending", 409, "INVITATION_UNAVAILABLE");
            let tokenHash: string | undefined;
            if (action === "RENEW") {
                assertWorkspaceWritable(context.workspace);
                await manager(tx, workspaceId, actorId, invitation.role);
                if (invitation.tokenHash) {
                    if (invitation.emailQueuedAt && Date.now() - invitation.emailQueuedAt.getTime() < 60_000)
                        throw new AppError("Wait a minute before resending", 429, "INVITATION_RESEND_LIMIT");
                    tokenHash = emailProof(invitation.id, version + 1);
                } else if (invitation.recipientUserId) {
                    const email = await verifiedRecipient(tx, invitation.recipientUserId);
                    if (invitation.invitedEmail && invitation.invitedEmail !== email) throw new AppError("Recipient email has changed", 409, "INVITATION_UNAVAILABLE");
                    await requireActiveActor(tx, actorId);
                }
            }
            const updated = await tx.workspaceInvitation.update({ where: { id: invitationId }, data: {
                status: action === "REVOKE" ? "REVOKED" : "PENDING", version: { increment: 1 }, updatedAt: new Date(),
                ...(action === "RENEW" ? { expiresAt: new Date(Date.now() + lifetimeMs), invitedBy: actorId } : {}),
                ...(tokenHash ? { tokenHash, emailStatus: "QUEUED", emailQueuedAt: new Date(), emailSentAt: null } : {})
            }, select: safeInvitation });
            if (tokenHash) await queueEmail(tx, { ...updated, organizationId: context.organizationId }, actorId);
            return { resourceId: workspaceId, invitation: updated };
        } });
}
