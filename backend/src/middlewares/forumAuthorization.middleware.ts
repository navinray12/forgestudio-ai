import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";

export type ForumPermission =
  | "forum:view"
  | "forum:create_topic"
  | "forum:reply"
  | "forum:edit_own"
  | "forum:delete_own"
  | "forum:react"
  | "forum:bookmark"
  | "forum:follow"
  | "forum:report"
  | "forum:accept_answer"
  | "forum:moderate_pin"
  | "forum:moderate_lock"
  | "forum:moderate_hide"
  | "forum:moderate_move"
  | "forum:manage_categories"
  | "forum:view_analytics";

const ROLE_PERMISSIONS: Record<string, ForumPermission[]> = {
  USER: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
  ],
  TEAM_MEMBER: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
  ],
  SUPPORT_AGENT: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
    "forum:moderate_pin",
    "forum:moderate_lock",
    "forum:moderate_hide",
    "forum:moderate_move",
  ],
  SUPPORT_MANAGER: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
    "forum:moderate_pin",
    "forum:moderate_lock",
    "forum:moderate_hide",
    "forum:moderate_move",
    "forum:manage_categories",
    "forum:view_analytics",
  ],
  SUPPORT_ADMIN: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
    "forum:moderate_pin",
    "forum:moderate_lock",
    "forum:moderate_hide",
    "forum:moderate_move",
    "forum:manage_categories",
    "forum:view_analytics",
  ],
  ADMIN: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
    "forum:moderate_pin",
    "forum:moderate_lock",
    "forum:moderate_hide",
    "forum:moderate_move",
    "forum:manage_categories",
    "forum:view_analytics",
  ],
  SUPER_ADMIN: [
    "forum:view",
    "forum:create_topic",
    "forum:reply",
    "forum:edit_own",
    "forum:delete_own",
    "forum:react",
    "forum:bookmark",
    "forum:follow",
    "forum:report",
    "forum:accept_answer",
    "forum:moderate_pin",
    "forum:moderate_lock",
    "forum:moderate_hide",
    "forum:moderate_move",
    "forum:manage_categories",
    "forum:view_analytics",
  ],
};

export function isForumModeratorRole(role?: string): boolean {
  if (!role) return false;
  return [
    "SUPPORT_AGENT",
    "SUPPORT_MANAGER",
    "SUPPORT_ADMIN",
    "ADMIN",
    "SUPER_ADMIN",
    "PLATFORM_ADMIN",
  ].includes(role);
}

export function hasForumPermission(role: string, permission: ForumPermission): boolean {
  const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.USER;
  return allowed.includes(permission);
}

export function requireForumPermission(permission: ForumPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    }

    const role = user.role || "USER";
    if (!hasForumPermission(role, permission)) {
      return next(
        new AppError(
          `Permission denied. Requiring '${permission}' for role '${role}'`,
          403,
          "FORBIDDEN"
        )
      );
    }

    next();
  };
}
