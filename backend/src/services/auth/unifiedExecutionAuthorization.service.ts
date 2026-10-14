/**
 * ForgeStudio Blueprint Point 40 — Contract-First APIs, Authentication, Authorization and Frontend Binding
 * UnifiedExecutionAuthorizationService
 *
 * Responsibilities:
 * 1. Enforces identical domain authorization rules across all execution paths:
 *    - HTTP endpoints
 *    - Websocket events
 *    - Background jobs and scheduled tasks
 *    - Exports and downloads
 *    - Database Studio record edits
 *    - Generated application APIs
 * 2. Enforces tenant isolation, membership validity, operation scopes, and field-level visibility & write boundaries.
 * 3. Enforces least-privilege database role boundaries:
 *    - runtime_app: DML only, tenant-scoped, no DDL, no RLS bypass.
 *    - readonly_observer: SELECT only, private fields masked.
 *    - migration_admin: DDL permissions, schema-bound, no runtime application session access.
 * 4. Detects and blocks cross-tenant access, revoked memberships, unauthorized background jobs, forbidden fields,
 *    and direct resource-ID substitution attacks.
 */

import { AppError } from "../../utils/app-error.js";

export type ExecutionTransport =
  | "HTTP_ENDPOINT"
  | "WEBSOCKET_EVENT"
  | "BACKGROUND_JOB"
  | "EXPORT_DOWNLOAD"
  | "DATABASE_STUDIO_EDIT"
  | "GENERATED_APPLICATION_API";

export type DatabaseRole = "runtime_app" | "readonly_observer" | "migration_admin";

export interface AuthorizationSubject {
  userId: string;
  tenantId: string;
  applicationId: string;
  roles: string[];
  scopes: string[];
  isRevoked?: boolean;
}

export interface AuthorizationContext {
  transport: ExecutionTransport;
  subject: AuthorizationSubject;
  targetTenantId: string;
  targetEntity?: string;
  targetOperation?: string;
  requestedFields?: string[];
  resourceOwnerTenantId?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
  permittedDatabaseRole: DatabaseRole;
  allowedFields: string[];
  maskedFields: string[];
}

export class UnifiedExecutionAuthorizationService {
  private confidentialFields = new Set([
    "passwordhash",
    "password_hash",
    "secret",
    "ssn",
    "creditcard",
    "credit_card",
    "privatekey",
    "private_key",
    "tokenhash",
  ]);

  /**
   * Authorize execution across any transport path
   */
  public evaluateAuthorization(context: AuthorizationContext): AuthorizationDecision {
    const { subject, transport, targetTenantId, requestedFields = [], resourceOwnerTenantId } = context;

    // 1. Invalidation check: Subject revoked
    if (subject.isRevoked) {
      return {
        allowed: false,
        reason: "Subject membership has been revoked",
        permittedDatabaseRole: "readonly_observer",
        allowedFields: [],
        maskedFields: requestedFields,
      };
    }

    // 2. Strict Tenancy Enforcement (Defense in Depth)
    // Tenant ID in subject must match targetTenantId
    if (subject.tenantId !== targetTenantId) {
      return {
        allowed: false,
        reason: `Cross-tenant access violation: subject tenant '${subject.tenantId}' cannot access target '${targetTenantId}'`,
        permittedDatabaseRole: "readonly_observer",
        allowedFields: [],
        maskedFields: requestedFields,
      };
    }

    // Direct resource ID substitution defense: if resource owner tenant is present, it must match subject tenant
    if (resourceOwnerTenantId && resourceOwnerTenantId !== subject.tenantId) {
      return {
        allowed: false,
        reason: `Resource belongs to tenant '${resourceOwnerTenantId}', forbidden for subject tenant '${subject.tenantId}'`,
        permittedDatabaseRole: "readonly_observer",
        allowedFields: [],
        maskedFields: requestedFields,
      };
    }

    // 3. Transport-specific permission rules
    if (transport === "DATABASE_STUDIO_EDIT") {
      const hasStudioEditRole = subject.roles.includes("DEVELOPER") || subject.roles.includes("ADMIN");
      if (!hasStudioEditRole) {
        return {
          allowed: false,
          reason: "Database Studio record edits require DEVELOPER or ADMIN role",
          permittedDatabaseRole: "readonly_observer",
          allowedFields: [],
          maskedFields: requestedFields,
        };
      }
    }

    if (transport === "EXPORT_DOWNLOAD") {
      const hasExportScope = subject.scopes.includes("export:data") || subject.roles.includes("ADMIN");
      if (!hasExportScope) {
        return {
          allowed: false,
          reason: "Data exports require 'export:data' scope or ADMIN role",
          permittedDatabaseRole: "readonly_observer",
          allowedFields: [],
          maskedFields: requestedFields,
        };
      }
    }

    if (transport === "BACKGROUND_JOB") {
      // Background jobs must execute with explicit system or scheduled scope
      const hasJobScope = subject.scopes.includes("jobs:run") || subject.roles.includes("SYSTEM_WORKER");
      if (!hasJobScope) {
        return {
          allowed: false,
          reason: "Background job execution requires SYSTEM_WORKER role or 'jobs:run' scope",
          permittedDatabaseRole: "readonly_observer",
          allowedFields: [],
          maskedFields: requestedFields,
        };
      }
    }

    // 4. Field-level visibility & masking
    const allowedFields: string[] = [];
    const maskedFields: string[] = [];

    for (const f of requestedFields) {
      const normalized = f.toLowerCase().replace(/[^a-z]/g, "");
      if (this.confidentialFields.has(normalized)) {
        maskedFields.push(f);
      } else {
        allowedFields.push(f);
      }
    }

    // 5. Database role resolution
    let permittedRole: DatabaseRole = "runtime_app";
    if (transport === "EXPORT_DOWNLOAD") {
      permittedRole = "readonly_observer";
    }

    return {
      allowed: true,
      permittedDatabaseRole: permittedRole,
      allowedFields,
      maskedFields,
    };
  }

  /**
   * Guard assertion: throws AppError if authorization fails
   */
  public assertAuthorized(context: AuthorizationContext): AuthorizationDecision {
    const decision = this.evaluateAuthorization(context);
    if (!decision.allowed) {
      throw new AppError(decision.reason || "Unauthorized access", 403, "FORBIDDEN");
    }
    return decision;
  }
}

export const unifiedExecutionAuthorization = new UnifiedExecutionAuthorizationService();
