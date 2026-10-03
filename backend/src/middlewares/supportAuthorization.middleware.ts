import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";

export type SupportPermission =
  | "ticket:create"
  | "ticket:view_own"
  | "ticket:view_workspace"
  | "ticket:view_all"
  | "ticket:reply"
  | "ticket:internal_note"
  | "ticket:assign"
  | "ticket:change_status"
  | "ticket:change_priority"
  | "ticket:resolve"
  | "ticket:close"
  | "ticket:reopen"
  | "ticket:delete"
  | "ticket:manage_categories"
  | "ticket:manage_teams"
  | "ticket:manage_sla"
  | "ticket:view_analytics"
  | "ticket:view_audit";

const ROLE_PERMISSIONS: Record<string, SupportPermission[]> = {
  USER: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:reply",
    "ticket:reopen",
  ],
  TEAM_MEMBER: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:reply",
    "ticket:reopen",
  ],
  SUPPORT_AGENT: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:view_all",
    "ticket:reply",
    "ticket:internal_note",
    "ticket:assign",
    "ticket:change_status",
    "ticket:change_priority",
    "ticket:resolve",
    "ticket:reopen",
  ],
  SUPPORT_MANAGER: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:view_all",
    "ticket:reply",
    "ticket:internal_note",
    "ticket:assign",
    "ticket:change_status",
    "ticket:change_priority",
    "ticket:resolve",
    "ticket:close",
    "ticket:reopen",
    "ticket:delete",
    "ticket:manage_categories",
    "ticket:manage_teams",
    "ticket:manage_sla",
    "ticket:view_analytics",
    "ticket:view_audit",
  ],
  SUPPORT_ADMIN: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:view_all",
    "ticket:reply",
    "ticket:internal_note",
    "ticket:assign",
    "ticket:change_status",
    "ticket:change_priority",
    "ticket:resolve",
    "ticket:close",
    "ticket:reopen",
    "ticket:delete",
    "ticket:manage_categories",
    "ticket:manage_teams",
    "ticket:manage_sla",
    "ticket:view_analytics",
    "ticket:view_audit",
  ],
  ADMIN: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:view_all",
    "ticket:reply",
    "ticket:internal_note",
    "ticket:assign",
    "ticket:change_status",
    "ticket:change_priority",
    "ticket:resolve",
    "ticket:close",
    "ticket:reopen",
    "ticket:delete",
    "ticket:manage_categories",
    "ticket:manage_teams",
    "ticket:manage_sla",
    "ticket:view_analytics",
    "ticket:view_audit",
  ],
  SUPER_ADMIN: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:view_all",
    "ticket:reply",
    "ticket:internal_note",
    "ticket:assign",
    "ticket:change_status",
    "ticket:change_priority",
    "ticket:resolve",
    "ticket:close",
    "ticket:reopen",
    "ticket:delete",
    "ticket:manage_categories",
    "ticket:manage_teams",
    "ticket:manage_sla",
    "ticket:view_analytics",
    "ticket:view_audit",
  ],
  PLATFORM_ADMIN: [
    "ticket:create",
    "ticket:view_own",
    "ticket:view_workspace",
    "ticket:view_all",
    "ticket:reply",
    "ticket:internal_note",
    "ticket:assign",
    "ticket:change_status",
    "ticket:change_priority",
    "ticket:resolve",
    "ticket:close",
    "ticket:reopen",
    "ticket:delete",
    "ticket:manage_categories",
    "ticket:manage_teams",
    "ticket:manage_sla",
    "ticket:view_analytics",
    "ticket:view_audit",
  ],
};

export function hasSupportPermission(userRole: string, permission: SupportPermission): boolean {
  const allowedPermissions = ROLE_PERMISSIONS[userRole] || [];
  return allowedPermissions.includes(permission);
}

export function isSupportStaffRole(role: string): boolean {
  return [
    "SUPPORT_AGENT",
    "SUPPORT_MANAGER",
    "SUPPORT_ADMIN",
    "ADMIN",
    "SUPER_ADMIN",
    "PLATFORM_ADMIN",
  ].includes(role);
}

export function requireSupportPermission(permission: SupportPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user || (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    if (!hasSupportPermission(user.role, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Permission '${permission}' is required for this action.`,
        },
      });
    }

    next();
  };
}
