import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "../utils/app-error.js";
import { verifyProjectAccess } from "../modules/data-platform/common/project-access.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]);

export interface TenantScope {
  websiteId: string;
  tenantId: string;
  canAdminister: boolean;
}

/** The scope resolved by scopeToWebsite for this request. */
export function tenantScopeOf(res: Response): TenantScope {
  const scope = res.locals.tenantScope as TenantScope | undefined;
  if (!scope) throw new AppError("Tenant scope was not resolved", 500, "TENANT_SCOPE_MISSING");
  return scope;
}

/**
 * Scopes a request to a website the authenticated user belongs to (blueprint §18: tenant scope
 * comes from verified membership, never from a client-supplied ID). The client-supplied
 * tenantId/websiteId fields are overwritten with server-derived values, so downstream handlers
 * cannot act on another tenant. Non-members get 404; admin-only operations require an owner or
 * an OWNER/ADMIN member.
 */
export function scopeToWebsite(options: { admin?: boolean } = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = res.locals.user;
      if (!user?.id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
      const websiteId = req.body?.websiteId ?? req.query.websiteId;
      if (typeof websiteId !== "string" || !UUID.test(websiteId)) {
        throw new AppError("websiteId is required", 400, "WEBSITE_REQUIRED");
      }
      const access = await verifyProjectAccess(websiteId, user.id);
      if (options.admin && !access.canAdminister) {
        throw new AppError("Only website owners and admins can perform this operation", 403, "FORBIDDEN");
      }
      const scope: TenantScope = { websiteId, tenantId: access.tenantId, canAdminister: access.canAdminister };
      res.locals.tenantScope = scope;
      if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
        req.body.websiteId = scope.websiteId;
        req.body.tenantId = scope.tenantId;
      } else {
        req.body = { websiteId: scope.websiteId, tenantId: scope.tenantId };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Platform-wide data (e.g. the cross-tenant audit chain) is visible only to platform admins. */
export const requirePlatformAdmin: RequestHandler = (_req, res, next) => {
  const role = String(res.locals.user?.role || "").toUpperCase();
  if (!PLATFORM_ADMIN_ROLES.has(role)) {
    return next(new AppError("Platform administrator access is required", 403, "FORBIDDEN"));
  }
  next();
};
