import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requirePrivilegedMutation } from "../middlewares/privileged-mutation.js";
import { AppError } from "../utils/app-error.js";
import * as workspaces from "../services/workspaces/workspace-api.service.js";

import lifecycleRoutes from "./workspace-lifecycle.routes.js";

const router = Router();
router.use(lifecycleRoutes);
const idSchema = z.string().uuid();
const createSchema = z.object({ name: z.string().trim().min(1).max(100), organizationId: idSchema.optional() }).strict();
const memberSchema = z.object({ userId: idSchema, role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER") }).strict();
const websiteSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("Request does not match the workspace contract", 400, "VALIDATION_ERROR");
  return result.data;
}
function key(req: Request): string {
  // A cross-site HTML form cannot set this non-simple header. The application's
  // exact FRONTEND_URL CORS policy controls credentialed cross-origin clients.
  if (req.get("X-Forge-Intent") !== "workspace-command") throw new AppError("Workspace command header is required", 403, "REQUEST_INTENT_REQUIRED");
  return req.get("Idempotency-Key") || "";
}
router.use(requireAuth, requirePrivilegedMutation);
router.get("/", async (_req, res, next) => {
  try { res.json({ success: true, ...await workspaces.listTenantWorkspaces(res.locals.user.id) }); }
  catch (error) { next(error); }
});
router.post("/", async (req, res, next) => {
  try {
    const result = await workspaces.createTenantWorkspace(res.locals.user.id, parse(createSchema, req.body), key(req));
    res.status(201).json({ success: true, ...result });
  } catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
  try { const workspace=await workspaces.readTenantWorkspace(res.locals.user.id, parse(idSchema, req.params.id)); res.setHeader("ETag",`"${workspace.id}:${workspace.version}"`); res.json({ success: true, workspace }); }
  catch (error) { next(error); }
});
router.get("/:id/eligible-members", async (req, res, next) => {
  try { res.json({ success: true, members: await workspaces.listEligibleWorkspaceMembers(res.locals.user.id, parse(idSchema, req.params.id)) }); }
  catch (error) { next(error); }
});
router.post("/:id/members", async (req, res, next) => {
  try {
    const input = parse(memberSchema, req.body);
    res.json(await workspaces.addTenantWorkspaceMember(res.locals.user.id, parse(idSchema, req.params.id), input.userId, input.role, key(req)));
  } catch (error) { next(error); }
});
router.delete("/:id/members/:userId", async (req, res, next) => {
  try { res.json(await workspaces.removeTenantWorkspaceMember(res.locals.user.id, parse(idSchema, req.params.id), parse(idSchema, req.params.userId), key(req))); }
  catch (error) { next(error); }
});
router.post("/:id/websites", async (req, res, next) => {
  try {
    const input = parse(websiteSchema, req.body);
    res.status(201).json({ success: true, ...await workspaces.createTenantWorkspaceWebsite(res.locals.user.id, parse(idSchema, req.params.id), input.name, key(req)) });
  } catch (error) { next(error); }
});
export default router;
