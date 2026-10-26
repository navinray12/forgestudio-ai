import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requirePrivilegedMutation } from "../middlewares/privileged-mutation.js";
import { AppError } from "../utils/app-error.js";
import * as lifecycle from "../services/workspaces/lifecycle.service.js";
import * as invitations from "../services/workspaces/invitation.service.js";
const router = Router();
router.use(requireAuth, requirePrivilegedMutation);
const id = z.string().uuid();
const settings = z.object({ name: z.string().trim().min(1).max(100).optional(), settings: z.object({ locale: z.string().max(50).optional(), timeZone: z.string().max(100).optional() }).strict().optional() }).strict();
const target = z.object({ userId: id }).strict();
const member = z.object({ userId: id, role: z.enum(["ADMIN", "MEMBER"]) }).strict();
const invite = z.union([member, z.object({ email: z.string().trim().toLowerCase().max(254).email(), role: z.enum(["ADMIN", "MEMBER"]) }).strict()]);
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success)
    throw new AppError("Invalid workspace request", 400, "VALIDATION_ERROR"); return parsed.data; }
function key(req: Request): string { if (req.get("X-Forge-Intent") !== "workspace-command")
    throw new AppError("Workspace command intent required", 403, "REQUEST_INTENT_REQUIRED"); return req.get("Idempotency-Key") || ""; }
function version(req: Request, resourceId: string): number {
    const match = req.get("If-Match")?.match(/^"([a-f0-9-]{36}):([1-9][0-9]{0,9})"$/i);
    if (!match || match[1] !== resourceId)
        throw new AppError("The current resource ETag is required", 428, "PRECONDITION_REQUIRED");
    return Number(match[2]);
}
router.get("/invitations/inbox", async (_req, res, next) => { try {
    res.json({ success: true, ...await invitations.listWorkspaceInvitationInbox(res.locals.user.id) });
}
catch (error) {
    next(error);
} });
router.post("/invitations/:invitationId/resolve", async (req, res, next) => {
    try {
        key(req);
        const body = parse(z.object({ token }).strict(), req.body);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.json({ success: true, ...await invitations.resolveWorkspaceInvitation(res.locals.user.id, parse(id, req.params.invitationId), body.token) });
    } catch (error) { next(error); }
});
router.patch("/:id/settings", async (req, res, next) => {
    try {
        const workspaceId = parse(id, req.params.id);
        const result = await lifecycle.updateWorkspaceSettings(res.locals.user.id, workspaceId, parse(settings, req.body), version(req, workspaceId), key(req));
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
for (const action of ["archive", "restore"] as const)
    router.post(`/:id/${action}`, async (req, res, next) => {
        try {
            const workspaceId = parse(id, req.params.id);
            const body = parse(z.object({ reason: z.string().trim().min(1).max(500) }).strict(), req.body);
            res.json({ success: true, ...await lifecycle.changeWorkspaceLifecycle(res.locals.user.id, workspaceId, action === "archive" ? "ARCHIVED" : "ACTIVE", version(req, workspaceId), body.reason, key(req)) });
        }
        catch (error) {
            next(error);
        }
    });
router.post("/:id/ownership", async (req, res, next) => {
    try {
        const workspaceId = parse(id, req.params.id);
        const body = parse(target, req.body);
        res.json({ success: true, ...await lifecycle.transferWorkspaceOwnership(res.locals.user.id, workspaceId, body.userId, version(req, workspaceId), key(req)) });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/:id/member-role", async (req, res, next) => {
    try {
        const workspaceId = parse(id, req.params.id);
        const body = parse(member, req.body);
        res.json({ success: true, ...await lifecycle.changeWorkspaceMemberRole(res.locals.user.id, workspaceId, body.userId, body.role, version(req, workspaceId), key(req)) });
    }
    catch (error) {
        next(error);
    }
});
router.get("/:id/invitations", async (req, res, next) => { try {
    res.json({ success: true, invitations: await invitations.listWorkspaceInvitations(res.locals.user.id, parse(id, req.params.id)) });
}
catch (error) {
    next(error);
} });
router.post("/:id/invitations", async (req, res, next) => {
    try {
        const body = parse(invite, req.body);
        const workspaceId = parse(id, req.params.id);
        const result = "email" in body
            ? await invitations.inviteWorkspaceMemberByEmail(res.locals.user.id, workspaceId, body.email, body.role, key(req))
            : await invitations.inviteWorkspaceMember(res.locals.user.id, workspaceId, body.userId, body.role, key(req));
        res.status(201).json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.post("/:id/invitations/:invitationId/accept", async (req, res, next) => {
    try {
        const body = parse(z.object({ token: token.optional() }).strict(), req.body);
        res.json({ success: true, ...await invitations.acceptWorkspaceInvitation(res.locals.user.id, parse(id, req.params.id), parse(id, req.params.invitationId), key(req), body.token) });
    }
    catch (error) {
        next(error);
    }
});
for (const action of ["revoke", "renew"] as const)
    router.post(`/:id/invitations/:invitationId/${action}`, async (req, res, next) => {
        try {
            parse(z.object({}).strict(), req.body);
            const invitationId = parse(id, req.params.invitationId);
            res.json({ success: true, ...await invitations.updateWorkspaceInvitation(res.locals.user.id, parse(id, req.params.id), invitationId, action === "revoke" ? "REVOKE" : "RENEW", version(req, invitationId), key(req)) });
        }
        catch (error) {
            next(error);
        }
    });
export default router;
