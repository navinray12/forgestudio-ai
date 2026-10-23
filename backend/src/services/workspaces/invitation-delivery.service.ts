import { randomUUID } from "node:crypto";
import { pgPool, prisma } from "../../config/prisma.js";
import { sendSmtpMessage } from "../../adapters/identity/smtp-delivery.js";
import { invitationToken, invitationLink, matchesInvitationToken } from "./invitation-token.js";

type Delivery = { id: string; organizationId: string; actorId: string; resourceId: string;
    payload: { invitationId: string; version: number }; attempts: number; lockToken: string };
const maxAttempts = 8;

// The background-worker database identity needs cross-tenant outbox access,
// like the existing durable job worker. Request-serving identities remain RLS scoped.
export async function dispatchWorkspaceInvitationEmail(
    send: typeof sendSmtpMessage = sendSmtpMessage,
): Promise<boolean> {
    const lease = randomUUID();
    const claimed = await pgPool.query<Delivery>(`
      WITH ready AS (
        SELECT id FROM workspace_outbox
        WHERE operation='WORKSPACE_INVITATION_EMAIL' AND "dispatchedAt" IS NULL
          AND "availableAt"<=now() AND ("lockedUntil" IS NULL OR "lockedUntil"<now())
        ORDER BY "availableAt",id LIMIT 1 FOR UPDATE SKIP LOCKED
      ) UPDATE workspace_outbox o SET "lockToken"=$1::uuid,"lockedUntil"=now()+interval '60 seconds',attempts=o.attempts+1
        FROM ready WHERE o.id=ready.id RETURNING o.*`, [lease]);
    const event = claimed.rows[0];
    if (!event) return false;
    try {
        const invitation = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT set_config('app.tenant_id',${event.organizationId},true)`;
            await tx.$queryRaw`SELECT set_config('app.actor_id',${event.actorId},true)`;
            return tx.workspaceInvitation.findFirst({ where: { id: event.resourceId, organizationId: event.organizationId } });
        });
        const version = event.payload?.version;
        // A superseded, revoked, accepted or expired invitation must never be sent.
        if (!invitation || invitation.status !== "PENDING" || invitation.version !== version ||
            invitation.expiresAt.getTime() <= Date.now() || !invitation.invitedEmail || invitation.emailStatus === "SENT") {
            await finish(event, "SKIPPED");
            return true;
        }
        const token = invitationToken(invitation.id, version);
        if (!matchesInvitationToken(token, invitation.tokenHash)) throw new Error("INVITATION_KEY_CHANGED");
        const link = invitationLink(invitation.id, token);
        await send({ email: invitation.invitedEmail, subject: "You have been invited to a Forge workspace",
            messageId: `<workspace-invitation.${invitation.id}.${version}@${new URL(link).hostname}>`,
            text: `You have been invited to join a Forge workspace as ${invitation.role}.\n\n` +
                `Sign in or create an account using this email address, then accept your invitation:\n${link}\n\n` +
                `This invitation expires at ${invitation.expiresAt.toISOString()}. If you did not expect it, ignore this email.` });
        await finish(event, "SENT");
    } catch {
        // Provider/ORM errors can contain message bodies or credentials. Store a
        // fixed code only; the same link is retried with bounded exponential backoff.
        await finish(event, "FAILED");
    }
    return true;
}

async function finish(event: Delivery, outcome: "SENT" | "FAILED" | "SKIPPED") {
    await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id',${event.organizationId},true)`;
        const terminal = outcome !== "FAILED" || event.attempts >= maxAttempts;
        const delay = Math.min(3600, 30 * 2 ** Math.min(event.attempts - 1, 7));
        // Fencing prevents a worker whose lease expired from acknowledging a newer claim.
        const updated = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE workspace_outbox SET "dispatchedAt"=${terminal ? new Date() : null},
            "availableAt"=now()+(${delay}::text||' seconds')::interval,
            "lockedUntil"=NULL,"lockToken"=NULL,"lastError"=${outcome === "FAILED" ? "INVITATION_EMAIL_DELIVERY_FAILED" : null}
          WHERE id=${event.id}::uuid AND "lockToken"=${event.lockToken}::uuid AND "lockedUntil">now() RETURNING id`;
        if (updated.length && outcome !== "SKIPPED") {
            await tx.workspaceInvitation.updateMany({ where: { id: event.resourceId, organizationId: event.organizationId,
                version: event.payload.version, status: "PENDING" }, data: {
                emailStatus: outcome === "SENT" ? "SENT" : terminal ? "FAILED" : "QUEUED",
                ...(outcome === "SENT" ? { emailSentAt: new Date() } : {}),
            } });
        }
    });
}
