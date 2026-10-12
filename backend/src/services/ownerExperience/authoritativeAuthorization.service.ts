import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";
import {
  SYSTEM_PERMISSIONS,
  evaluateEffectivePermissions,
  type PermissionDefinition,
} from "./dynamicPermissionEngine.service.js";

export interface AuthorizationContext {
  userId: string;
  userRole: string;
  customRoleId?: string;
  userStatus: "ACTIVE" | "SUSPENDED" | "DELETED";
  workspaceId: string;
  organizationId?: string;
  websiteId?: string;
  mfaVerified?: boolean;
  independentApproverId?: string;
  overrides?: Array<{ permissionId: string; effect: "ALLOW" | "DENY"; resourceScope?: string }>;
  enabledCapabilities?: string[];
  isResourceArchived?: boolean;
}

export interface JobAuthorizationToken {
  jobId: string;
  userId: string;
  workspaceId: string;
  roleAtSubmission: string;
  roleVersionAtSubmission: number;
  requiredPermissions: string[];
  issuedAt: string;
  expiresAt: string;
}

// Track active job tokens
const jobLeaseRegistry = new Map<string, JobAuthorizationToken>();

// ---------------------------------------------------------------------------
// 1. Redaction Utility for Structured Audit Logs
// ---------------------------------------------------------------------------
const SENSITIVE_KEYS = new RegExp(
  "password|token|secret|apiKey|authorization|cookie|card|cvv|ssn|privateKey",
  "i"
);

export function redactSensitiveData(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.test(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ---------------------------------------------------------------------------
// 2. Authoritative Centralized Authorization Engine
// ---------------------------------------------------------------------------
export async function authorizeAction(params: {
  context: AuthorizationContext;
  requiredPermissionId: string;
  resourceId?: string;
  actionDetails?: any;
}): Promise<{ authorized: boolean; permission: PermissionDefinition }> {
  const { context, requiredPermissionId, resourceId = "*", actionDetails = {} } = params;

  // 1. Authenticated principal & account status
  if (!context.userId || context.userStatus !== "ACTIVE") {
    await recordAuthorizationAudit("ACCESS_DENIED_INACTIVE_ACCOUNT", context, requiredPermissionId, {
      reason: "Account is inactive, suspended, or missing",
    });
    throw new AppError("Account is not active or unauthorized", 403, "ACCOUNT_INACTIVE");
  }

  // 2. Permission definition lookup
  const perm = SYSTEM_PERMISSIONS[requiredPermissionId];
  if (!perm) {
    throw new AppError(`Unknown permission requirement: ${requiredPermissionId}`, 400, "BAD_REQUEST");
  }

  // 3. Resource lifecycle check
  if (context.isResourceArchived && !perm.allowedActions.includes("READ")) {
    await recordAuthorizationAudit("ACCESS_DENIED_ARCHIVED_RESOURCE", context, requiredPermissionId, {
      reason: "Resource is archived; only read actions permitted",
    });
    throw new AppError("Resource is archived and read-only", 409, "RESOURCE_ARCHIVED");
  }

  // 4. Capability prerequisites check (Point 05 integration)
  if (perm.capabilityPrerequisites.length > 0 && context.enabledCapabilities) {
    const missingCaps = perm.capabilityPrerequisites.filter(
      (cap) => !context.enabledCapabilities?.includes(cap)
    );
    if (missingCaps.length > 0) {
      await recordAuthorizationAudit("ACCESS_DENIED_MISSING_CAPABILITY", context, requiredPermissionId, {
        missingCapabilities: missingCaps,
      });
      throw new AppError(
        `Action requires unfulfilled capability: ${missingCaps.join(", ")}`,
        403,
        "CAPABILITY_REQUIRED"
      );
    }
  }

  // 5. Effective permission evaluation (Role + Overrides)
  const evalResult = evaluateEffectivePermissions({
    role: context.userRole,
    customRoleId: context.customRoleId,
    overrides: context.overrides,
    targetResourceScope: resourceId,
  });

  if (!evalResult.allowedPermissions.has(requiredPermissionId)) {
    await recordAuthorizationAudit("ACCESS_DENIED_INSUFFICIENT_PERMISSIONS", context, requiredPermissionId, {
      reason: "Role does not grant this permission or explicit DENY override in effect",
    });
    throw new AppError(
      `Forbidden: You do not have permission '${perm.name}' (${requiredPermissionId})`,
      403,
      "FORBIDDEN"
    );
  }

  // 6. Step-up Authentication / MFA requirement
  if (perm.requiredApproval === "STEP_UP_MFA" && !context.mfaVerified) {
    await recordAuthorizationAudit("MFA_STEP_UP_REQUIRED", context, requiredPermissionId, {
      riskClassification: perm.riskClassification,
    });
    throw new AppError(
      `Step-up multi-factor authentication required for high-risk action '${perm.name}'`,
      403,
      "STEP_UP_MFA_REQUIRED"
    );
  }

  // 7. Independent Approver requirement (e.g., permanent purge or account transfer)
  if (perm.requiredApproval === "INDEPENDENT_APPROVER") {
    if (!context.independentApproverId || context.independentApproverId === context.userId) {
      await recordAuthorizationAudit("INDEPENDENT_APPROVAL_REQUIRED", context, requiredPermissionId, {
        reason: "Dual-custody independent approval required",
      });
      throw new AppError(
        `Dual-custody independent approver required for critical action '${perm.name}'`,
        403,
        "INDEPENDENT_APPROVAL_REQUIRED"
      );
    }
  }

  // 8. Audit Logging (Mandatory for high/critical risks)
  if (perm.auditRequirements === "MANDATORY_AUDIT") {
    await recordAuthorizationAudit("HIGH_RISK_ACTION_AUTHORIZED", context, requiredPermissionId, actionDetails);
  }

  return { authorized: true, permission: perm };
}

async function recordAuthorizationAudit(
  action: string,
  context: AuthorizationContext,
  permissionId: string,
  details: any
) {
  try {
    await recordAuditLog({
      userId: context.userId,
      action,
      targetResource: context.websiteId ? `website:${context.websiteId}` : `workspace:${context.workspaceId}`,
      details: redactSensitiveData({
        permissionId,
        userRole: context.userRole,
        workspaceId: context.workspaceId,
        ...details,
      }),
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 3. Long-Running Job Re-authorization at Execution / Commit Time
// ---------------------------------------------------------------------------

/**
 * Issues a scoped job lease token when a long-running background task is scheduled.
 */
export function issueJobLeaseToken(params: {
  jobId: string;
  userId: string;
  workspaceId: string;
  userRole: string;
  roleVersion: number;
  requiredPermissions: string[];
  ttlMs?: number;
}): JobAuthorizationToken {
  const { jobId, userId, workspaceId, userRole, roleVersion, requiredPermissions, ttlMs = 3600000 } = params;
  const token: JobAuthorizationToken = {
    jobId,
    userId,
    workspaceId,
    roleAtSubmission: userRole,
    roleVersionAtSubmission: roleVersion,
    requiredPermissions,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };

  jobLeaseRegistry.set(jobId, token);
  return token;
}

/**
 * Re-validates job authority right before committing results or writing state.
 * Prevents stale workers from committing after role downgrade, revocation, or membership removal!
 */
export async function revalidateJobExecutionAuthority(params: {
  jobId: string;
  currentContext: AuthorizationContext;
}): Promise<{ valid: boolean; token: JobAuthorizationToken }> {
  const { jobId, currentContext } = params;
  const token = jobLeaseRegistry.get(jobId);

  if (!token) {
    throw new AppError(`Job lease token not found or already completed: ${jobId}`, 404, "JOB_TOKEN_NOT_FOUND");
  }

  // Verify expiry
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    jobLeaseRegistry.delete(jobId);
    throw new AppError("Job lease token has expired", 401, "JOB_TOKEN_EXPIRED");
  }

  // Verify actor matches
  if (token.userId !== currentContext.userId) {
    throw new AppError("Job lease actor mismatch", 403, "JOB_ACTOR_MISMATCH");
  }

  // Verify user is still active
  if (currentContext.userStatus !== "ACTIVE") {
    jobLeaseRegistry.delete(jobId);
    await recordAuthorizationAudit("STALE_JOB_AUTHORITY_REVOKED", currentContext, token.requiredPermissions[0] || "", {
      jobId,
      reason: "Account suspended or deactivated during job execution",
    });
    throw new AppError(
      "Authority revoked: Account was deactivated during job execution",
      403,
      "STALE_JOB_AUTHORITY_REVOKED"
    );
  }

  // Re-evaluate current effective permissions
  const evalResult = evaluateEffectivePermissions({
    role: currentContext.userRole,
    customRoleId: currentContext.customRoleId,
    overrides: currentContext.overrides,
  });

  for (const requiredPerm of token.requiredPermissions) {
    if (!evalResult.allowedPermissions.has(requiredPerm)) {
      jobLeaseRegistry.delete(jobId);
      await recordAuthorizationAudit("STALE_JOB_AUTHORITY_REVOKED", currentContext, requiredPerm, {
        jobId,
        reason: `User role or overrides changed during execution, revoking permission '${requiredPerm}'`,
      });
      throw new AppError(
        `Authority revoked: User no longer holds required permission '${requiredPerm}' at commit time`,
        403,
        "STALE_JOB_AUTHORITY_REVOKED"
      );
    }
  }

  return { valid: true, token };
}

export function completeJobLease(jobId: string) {
  jobLeaseRegistry.delete(jobId);
}
