import { AppError } from "../../utils/app-error.js";
import { workspaceCommand } from "./command.js";
import { boundedName, requireWorkspace, requireActiveActor, requireOrganization, memberRole } from "./access.js";
import { assertWorkspaceVersion, assertWorkspaceWritable, expectedWorkspaceVersion, workspaceSettings, boundedReason, publicWorkspaceSettings } from "./lifecycle-policy.js";
export async function updateWorkspaceSettings(actorId: string, workspaceId: string, input: {
    name?: string;
    settings?: unknown;
}, version: number, key: string) {
    expectedWorkspaceVersion(version);
    const name = input.name === undefined ? undefined : boundedName(input.name, "Workspace name");
    const settings = input.settings === undefined ? undefined : workspaceSettings(input.settings);
    if (name === undefined && settings === undefined)
        throw new AppError("No workspace changes supplied", 400, "VALIDATION_ERROR");
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_UPDATED", payload: { workspaceId, version, name, settings },
        authorize: async (tx) => { const context = await requireWorkspace(tx, workspaceId, actorId, true); return { ...context, organizationId: context.organization.id }; },
        execute: async (tx, context) => {
            assertWorkspaceWritable(context.workspace);
            assertWorkspaceVersion(context.workspace.version, version);
            const oldSettings = context.workspace.settings;
            const updated = await tx.workspace.update({ where: { id: workspaceId }, data: { name,
                    ...(settings ? { settings: { ...(oldSettings && typeof oldSettings === "object" && !Array.isArray(oldSettings) ? oldSettings : {}), ...settings } } : {}),
                    version: { increment: 1 } }, select: { id: true, name: true, settings: true, version: true, lifecycleStatus: true } });
            return { resourceId: workspaceId, workspace: { ...updated, settings: publicWorkspaceSettings(updated.settings) } };
        } });
}
export async function changeWorkspaceLifecycle(actorId: string, workspaceId: string, status: "ACTIVE" | "ARCHIVED", version: number, reason: string, key: string) {
    expectedWorkspaceVersion(version);
    reason = boundedReason(reason);
    if (!["ACTIVE", "ARCHIVED"].includes(status))
        throw new AppError("Invalid workspace lifecycle", 400, "VALIDATION_ERROR");
    return workspaceCommand({ actorId, key, operation: status === "ARCHIVED" ? "WORKSPACE_ARCHIVED" : "WORKSPACE_RESTORED", payload: { workspaceId, status, version, reason },
        authorize: async (tx) => { const context = await requireWorkspace(tx, workspaceId, actorId, true); return { ...context, organizationId: context.organization.id }; },
        execute: async (tx, context) => {
            if (context.membership.role !== "OWNER")
                throw new AppError("Only the owner may archive or restore a workspace", 403, "FORBIDDEN");
            assertWorkspaceVersion(context.workspace.version, version);
            if (context.workspace.lifecycleStatus === status)
                throw new AppError("Workspace is already in that state", 409, "INVALID_TRANSITION");
            if (status === "ARCHIVED") {
                const active = await tx.deployment.count({ where: { website: { workspaceId }, status: { in: ["QUEUED", "VALIDATING", "BUILDING", "PROCESSING", "DEPLOYING", "VERIFYING", "RECONCILIATION_REQUIRED"] } } });
                const scheduled = await tx.customCodeSnippet.count({ where: { website: { workspaceId }, status: "SCHEDULED" } });
                const pending = await tx.$queryRaw<Array<{
                    count: bigint;
                }>> `SELECT count(*) FROM background_jobs WHERE status IN ('QUEUED','RUNNING','RETRYING') AND payload->>'websiteId' IN (SELECT id::text FROM websites WHERE "workspaceId"=${workspaceId}::uuid)`;
                if (active || scheduled || Number(pending[0]?.count))
                    throw new AppError("Drain or reconcile pending publication work before archiving", 409, "WORKSPACE_BUSY");
            }
            const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: { lifecycleStatus: status, archivedAt: status === "ARCHIVED" ? new Date() : null, version: { increment: 1 } }, select: { id: true, lifecycleStatus: true, archivedAt: true, version: true } });
            return { resourceId: workspaceId, workspace };
        } });
}
export async function changeWorkspaceMemberRole(actorId: string, workspaceId: string, targetUserId: string, requestedRole: unknown, version: number, key: string) {
    const role = memberRole(requestedRole);
    expectedWorkspaceVersion(version);
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_MEMBER_ROLE_CHANGED", payload: { workspaceId, targetUserId, role, version },
        authorize: async (tx) => { const context = await requireWorkspace(tx, workspaceId, actorId, true); return { ...context, organizationId: context.organization.id }; },
        execute: async (tx, context) => {
            assertWorkspaceWritable(context.workspace);
            assertWorkspaceVersion(context.workspace.version, version);
            if (context.membership.role !== "OWNER")
                throw new AppError("Only the owner may change administrator roles", 403, "FORBIDDEN");
            if (targetUserId === context.workspace.ownerId)
                throw new AppError("Transfer ownership before changing the owner role", 409, "OWNER_TRANSFER_REQUIRED");
            await requireActiveActor(tx, targetUserId);
            await requireOrganization(tx, context.organizationId, targetUserId);
            const target = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } });
            if (!target)
                throw new AppError("Workspace member not found", 404, "NOT_FOUND");
            await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } }, data: { role } });
            const changed = await tx.workspace.update({ where: { id: workspaceId }, data: { version: { increment: 1 } }, select: { version: true } });
            return { resourceId: workspaceId, userId: targetUserId, role, version: changed.version };
        } });
}
export async function transferWorkspaceOwnership(actorId: string, workspaceId: string, targetUserId: string, version: number, key: string) {
    expectedWorkspaceVersion(version);
    return workspaceCommand({ actorId, key, operation: "WORKSPACE_OWNER_TRANSFERRED", payload: { workspaceId, targetUserId, version },
        // The previous owner remains an administrator so a lost response can replay.
        // Mutation authority is checked below, after an authorized journal lookup.
        authorize: async (tx) => { const context = await requireWorkspace(tx, workspaceId, actorId, true); return { ...context, organizationId: context.organization.id }; },
        execute: async (tx, context) => {
            assertWorkspaceWritable(context.workspace);
            assertWorkspaceVersion(context.workspace.version, version);
            if (context.membership.role !== "OWNER" || context.workspace.ownerId !== actorId)
                throw new AppError("Only the owner may transfer ownership", 403, "FORBIDDEN");
            if (targetUserId === actorId)
                throw new AppError("Choose another active member", 400, "INVALID_TARGET");
            await requireActiveActor(tx, targetUserId);
            await requireOrganization(tx, context.organizationId, targetUserId);
            const target = await requireWorkspace(tx, workspaceId, targetUserId);
            if (!["ADMIN", "MEMBER"].includes(target.membership.role))
                throw new AppError("Invalid ownership recipient", 409, "INVALID_TARGET");
            await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: actorId } }, data: { role: "ADMIN" } });
            await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } }, data: { role: "OWNER" } });
            const changed = await tx.workspace.update({ where: { id: workspaceId }, data: { ownerId: targetUserId, version: { increment: 1 } }, select: { version: true } });
            return { resourceId: workspaceId, previousOwnerId: actorId, ownerId: targetUserId, version: changed.version };
        } });
}
