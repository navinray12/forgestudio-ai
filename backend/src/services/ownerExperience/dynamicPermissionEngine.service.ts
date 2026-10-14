import { AppError } from "../../utils/app-error.js";

export type RiskClassification = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ResourceType =
  | "platform"
  | "workspace"
  | "website"
  | "collection"
  | "content_entry"
  | "lead"
  | "integration"
  | "release"
  | "domain";

export type RequiredApproval = "NONE" | "STEP_UP_MFA" | "INDEPENDENT_APPROVER";

export type AuditRequirement = "STANDARD" | "MANDATORY_AUDIT";

export type AllowedAction =
  | "READ"
  | "WRITE"
  | "EXECUTE"
  | "ADMIN"
  | "EXPORT"
  | "PUBLISH"
  | "PURGE";

export interface PermissionDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  riskClassification: RiskClassification;
  allowedActions: AllowedAction[];
  resourceType: ResourceType;
  resourceScope: string; // "*" or specific UUID
  requiredApproval: RequiredApproval;
  capabilityPrerequisites: string[];
  auditRequirements: AuditRequirement;
  delegationRules: {
    minimumAssignerRisk: RiskClassification;
    requiresSelfPossession: boolean;
  };
}

export interface RoleDefinition {
  id: string;
  name: string;
  version: number;
  description: string;
  isBuiltIn: boolean;
  permissions: string[]; // Permission IDs
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleAssignment {
  userId: string;
  workspaceId: string;
  websiteId?: string;
  roleId: string;
  roleVersion: number;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  resourceScope: string;
}

// ---------------------------------------------------------------------------
// 1. Authoritative Versioned Permission Catalog
// ---------------------------------------------------------------------------
export const SYSTEM_PERMISSIONS: Record<string, PermissionDefinition> = {
  // High-Risk Independently Controlled Permissions
  "perm:content:edit": {
    id: "perm:content:edit",
    version: "1.0.0",
    name: "Edit Content",
    description: "Create and modify draft content, blog posts, and collection entries",
    riskClassification: "LOW",
    allowedActions: ["READ", "WRITE"],
    resourceType: "content_entry",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: ["CAP-102"],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "MEDIUM", requiresSelfPossession: true },
  },
  "perm:content:publish": {
    id: "perm:content:publish",
    version: "1.0.0",
    name: "Publish Content",
    description: "Switch public revision pointer to make content live",
    riskClassification: "HIGH",
    allowedActions: ["PUBLISH"],
    resourceType: "content_entry",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: ["CAP-102"],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },
  "perm:schema:migrate": {
    id: "perm:schema:migrate",
    version: "1.0.0",
    name: "Migrate Schema",
    description: "Add, rename, or modify collection fields and content schemas",
    riskClassification: "HIGH",
    allowedActions: ["WRITE", "ADMIN"],
    resourceType: "collection",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: ["CAP-102"],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },
  "perm:code:approve": {
    id: "perm:code:approve",
    version: "1.0.0",
    name: "Approve Custom Code",
    description: "Approve custom JSX/TSX components and script injections",
    riskClassification: "HIGH",
    allowedActions: ["EXECUTE", "ADMIN"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "STEP_UP_MFA",
    capabilityPrerequisites: ["CAP-104"],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },
  "perm:secrets:manage": {
    id: "perm:secrets:manage",
    version: "1.0.0",
    name: "Manage Integration Secrets",
    description: "Read, configure, and rotate third-party credentials and API keys",
    riskClassification: "CRITICAL",
    allowedActions: ["READ", "WRITE", "ADMIN"],
    resourceType: "integration",
    resourceScope: "*",
    requiredApproval: "STEP_UP_MFA",
    capabilityPrerequisites: ["CAP-103"],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "CRITICAL", requiresSelfPossession: true },
  },
  "perm:billing:override": {
    id: "perm:billing:override",
    version: "1.0.0",
    name: "Override Spending Limits",
    description: "Increase budget boundaries and authorize billable generative units",
    riskClassification: "CRITICAL",
    allowedActions: ["ADMIN"],
    resourceType: "workspace",
    resourceScope: "*",
    requiredApproval: "STEP_UP_MFA",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "CRITICAL", requiresSelfPossession: true },
  },
  "perm:pii:export": {
    id: "perm:pii:export",
    version: "1.0.0",
    name: "Export Customer PII",
    description: "Download unmasked customer lead and form submission records",
    riskClassification: "HIGH",
    allowedActions: ["EXPORT"],
    resourceType: "lead",
    resourceScope: "*",
    requiredApproval: "STEP_UP_MFA",
    capabilityPrerequisites: ["CAP-101"],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },
  "perm:domain:transfer": {
    id: "perm:domain:transfer",
    version: "1.0.0",
    name: "Transfer Domain",
    description: "Re-assign custom domain DNS authority and ownership records",
    riskClassification: "CRITICAL",
    allowedActions: ["ADMIN"],
    resourceType: "domain",
    resourceScope: "*",
    requiredApproval: "STEP_UP_MFA",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "CRITICAL", requiresSelfPossession: true },
  },
  "perm:purge:execute": {
    id: "perm:purge:execute",
    version: "1.0.0",
    name: "Execute Permanent Purge",
    description: "Irrevocably remove soft-deleted protected source, websites, or content",
    riskClassification: "CRITICAL",
    allowedActions: ["PURGE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "INDEPENDENT_APPROVER",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "CRITICAL", requiresSelfPossession: true },
  },
  "perm:roles:admin": {
    id: "perm:roles:admin",
    version: "1.0.0",
    name: "Administer Roles & Permissions",
    description: "Create custom roles, update policies, and assign member permissions",
    riskClassification: "HIGH",
    allowedActions: ["ADMIN"],
    resourceType: "workspace",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },
  "perm:account:transfer": {
    id: "perm:account:transfer",
    version: "1.0.0",
    name: "Transfer Account Ownership",
    description: "Transfer primary organization or workspace ownership to another user",
    riskClassification: "CRITICAL",
    allowedActions: ["ADMIN"],
    resourceType: "platform",
    resourceScope: "*",
    requiredApproval: "INDEPENDENT_APPROVER",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "CRITICAL", requiresSelfPossession: true },
  },
  "perm:support:delegate": {
    id: "perm:support:delegate",
    version: "1.0.0",
    name: "Delegate Time-Limited Support Access",
    description: "Authorize platform support staff for temporary, audited troubleshooting access",
    riskClassification: "HIGH",
    allowedActions: ["ADMIN"],
    resourceType: "workspace",
    resourceScope: "*",
    requiredApproval: "STEP_UP_MFA",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },

  // Standard Workspace Area Permissions
  "perm:overview:view": {
    id: "perm:overview:view",
    version: "1.0.0",
    name: "View Overview & Tasks",
    description: "View dashboard metrics, pending action items, and task priorities",
    riskClassification: "LOW",
    allowedActions: ["READ"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "LOW", requiresSelfPossession: true },
  },
  "perm:pages:edit": {
    id: "perm:pages:edit",
    version: "1.0.0",
    name: "Edit Pages & Layout",
    description: "Edit website sections, page structure, and responsive layouts",
    riskClassification: "MEDIUM",
    allowedActions: ["READ", "WRITE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "MEDIUM", requiresSelfPossession: true },
  },
  "perm:design:edit": {
    id: "perm:design:edit",
    version: "1.0.0",
    name: "Edit Design Tokens",
    description: "Manage brand tokens, colors, typography, and visual themes",
    riskClassification: "MEDIUM",
    allowedActions: ["READ", "WRITE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "MEDIUM", requiresSelfPossession: true },
  },
  "perm:media:manage": {
    id: "perm:media:manage",
    version: "1.0.0",
    name: "Manage Media Assets",
    description: "Upload, replace, and organize media assets and image rights",
    riskClassification: "LOW",
    allowedActions: ["READ", "WRITE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "LOW", requiresSelfPossession: true },
  },
  "perm:forms:manage": {
    id: "perm:forms:manage",
    version: "1.0.0",
    name: "Manage Forms",
    description: "Create and configure lead capture forms, notifications, and webhooks",
    riskClassification: "MEDIUM",
    allowedActions: ["READ", "WRITE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: ["CAP-101"],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "MEDIUM", requiresSelfPossession: true },
  },
  "perm:leads:view": {
    id: "perm:leads:view",
    version: "1.0.0",
    name: "View Leads & Inquiries",
    description: "Inspect inbound customer inquiries, assignments, and conversation inbox",
    riskClassification: "MEDIUM",
    allowedActions: ["READ"],
    resourceType: "lead",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: ["CAP-101"],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "MEDIUM", requiresSelfPossession: true },
  },
  "perm:campaigns:manage": {
    id: "perm:campaigns:manage",
    version: "1.0.0",
    name: "Manage Growth & Campaigns",
    description: "Generate UTM links, campaign calendar, and audience targeting",
    riskClassification: "LOW",
    allowedActions: ["READ", "WRITE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: ["CAP-105"],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "LOW", requiresSelfPossession: true },
  },
  "perm:seo:manage": {
    id: "perm:seo:manage",
    version: "1.0.0",
    name: "Manage Search & Measurement",
    description: "Configure SEO meta, sitemaps, robots policy, and view crawl health",
    riskClassification: "LOW",
    allowedActions: ["READ", "WRITE"],
    resourceType: "website",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "LOW", requiresSelfPossession: true },
  },
  "perm:release:view": {
    id: "perm:release:view",
    version: "1.0.0",
    name: "View Release Status",
    description: "Inspect release verification gates, domain health, and publishing history",
    riskClassification: "LOW",
    allowedActions: ["READ"],
    resourceType: "release",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "LOW", requiresSelfPossession: true },
  },
  "perm:governance:view": {
    id: "perm:governance:view",
    version: "1.0.0",
    name: "View Governance",
    description: "View workspace members, active roles, and privacy request statuses",
    riskClassification: "LOW",
    allowedActions: ["READ"],
    resourceType: "workspace",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "STANDARD",
    delegationRules: { minimumAssignerRisk: "LOW", requiresSelfPossession: true },
  },
  "perm:audit:view": {
    id: "perm:audit:view",
    version: "1.0.0",
    name: "View Audit Logs",
    description: "Inspect immutable audit trails of workspace actions and permission events",
    riskClassification: "MEDIUM",
    allowedActions: ["READ"],
    resourceType: "workspace",
    resourceScope: "*",
    requiredApproval: "NONE",
    capabilityPrerequisites: [],
    auditRequirements: "MANDATORY_AUDIT",
    delegationRules: { minimumAssignerRisk: "HIGH", requiresSelfPossession: true },
  },
};

// ---------------------------------------------------------------------------
// 2. Built-in Roles mapped to Explicit Permissions
// ---------------------------------------------------------------------------
export const BUILTIN_ROLES: Record<string, RoleDefinition> = {
  OWNER: {
    id: "role:builtin:owner",
    name: "Owner",
    version: 1,
    description: "Full administrative authority across all website operations, billing, and lifecycle",
    isBuiltIn: true,
    permissions: Object.keys(SYSTEM_PERMISSIONS),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  ADMIN: {
    id: "role:builtin:admin",
    name: "Admin",
    version: 1,
    description: "Workspace operations and publishing manager. Purge and ownership transfer restricted.",
    isBuiltIn: true,
    permissions: Object.keys(SYSTEM_PERMISSIONS).filter(
      (p) => p !== "perm:purge:execute" && p !== "perm:account:transfer"
    ),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  DESIGNER: {
    id: "role:builtin:designer",
    name: "Designer",
    version: 1,
    description: "Visual design, page layouts, brand tokens, and draft content editing. Cannot publish directly.",
    isBuiltIn: true,
    permissions: [
      "perm:overview:view",
      "perm:pages:edit",
      "perm:design:edit",
      "perm:media:manage",
      "perm:content:edit",
      "perm:seo:manage",
      "perm:release:view",
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  DEVELOPER: {
    id: "role:builtin:developer",
    name: "Developer",
    version: 1,
    description: "Code integration, custom components, and technical releases. PII export restricted.",
    isBuiltIn: true,
    permissions: [
      "perm:overview:view",
      "perm:pages:edit",
      "perm:design:edit",
      "perm:media:manage",
      "perm:content:edit",
      "perm:code:approve",
      "perm:schema:migrate",
      "perm:release:view",
      "perm:seo:manage",
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  CONTENT_EDITOR: {
    id: "role:builtin:content_editor",
    name: "Content Editor",
    version: 1,
    description: "Author and edit draft blogs and collection entries. Cannot publish directly or edit code.",
    isBuiltIn: true,
    permissions: [
      "perm:overview:view",
      "perm:content:edit",
      "perm:media:manage",
      "perm:seo:manage",
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  CLIENT: {
    id: "role:builtin:client",
    name: "Client",
    version: 1,
    description: "Simple business owner view: draft content editing, viewing leads, simple publishing review.",
    isBuiltIn: true,
    permissions: [
      "perm:overview:view",
      "perm:content:edit",
      "perm:leads:view",
      "perm:campaigns:manage",
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  REVIEWER: {
    id: "role:builtin:reviewer",
    name: "Reviewer",
    version: 1,
    description: "Read-only access for QA, audits, and content approval sign-off.",
    isBuiltIn: true,
    permissions: [
      "perm:overview:view",
      "perm:release:view",
      "perm:governance:view",
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  VIEWER: {
    id: "role:builtin:viewer",
    name: "Viewer",
    version: 1,
    description: "Minimal read-only access to published preview and overview.",
    isBuiltIn: true,
    permissions: ["perm:overview:view"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

// In-memory custom roles registry (simulating persistent store for custom compositions)
const customRolesStore = new Map<string, RoleDefinition>();

// ---------------------------------------------------------------------------
// 3. Permission Engine Functions
// ---------------------------------------------------------------------------

export function getPermissionDefinition(permissionId: string): PermissionDefinition | null {
  return SYSTEM_PERMISSIONS[permissionId] || null;
}

export function getRoleDefinition(roleIdOrName: string): RoleDefinition | null {
  const upper = roleIdOrName.toUpperCase();
  if (BUILTIN_ROLES[upper]) return BUILTIN_ROLES[upper];
  return customRolesStore.get(roleIdOrName) || null;
}

/**
 * Creates or updates a custom role with explicit versioning and validation.
 */
export function createCustomRole(params: {
  creatorId: string;
  creatorPermissions: string[];
  name: string;
  description: string;
  permissions: string[];
}): RoleDefinition {
  const { creatorPermissions, name, description, permissions } = params;

  if (!name || !name.trim()) {
    throw new AppError("Role name is required", 400, "INVALID_ROLE_NAME");
  }

  // Verify all requested permissions exist in system catalog
  for (const permId of permissions) {
    if (!SYSTEM_PERMISSIONS[permId]) {
      throw new AppError(`Unknown permission: ${permId}`, 400, "UNKNOWN_PERMISSION");
    }
  }

  // Delegation Enforcement: Creator CANNOT grant permissions they themselves do not possess!
  const unpossessed = permissions.filter((p) => !creatorPermissions.includes(p));
  if (unpossessed.length > 0) {
    throw new AppError(
      `Cannot delegate permissions you do not possess: ${unpossessed.join(", ")}`,
      403,
      "UNAUTHORIZED_DELEGATION"
    );
  }

  const roleId = `role:custom:${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;
  const role: RoleDefinition = {
    id: roleId,
    name: name.trim(),
    version: 1,
    description: description.trim(),
    isBuiltIn: false,
    permissions: Array.from(new Set(permissions)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  customRolesStore.set(role.id, role);
  return role;
}

/**
 * Validates whether an assigner can assign a given role to a target user.
 */
export function validateDelegationAuthority(
  assignerPermissions: string[],
  targetRole: RoleDefinition
): { allowed: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const permId of targetRole.permissions) {
    if (!assignerPermissions.includes(permId)) {
      violations.push(permId);
    }
  }
  return {
    allowed: violations.length === 0,
    violations,
  };
}

/**
 * Evaluates effective permissions for a user given their base role and granular overrides.
 */
export function evaluateEffectivePermissions(params: {
  role: string;
  customRoleId?: string;
  overrides?: Array<{ permissionId: string; effect: "ALLOW" | "DENY"; resourceScope?: string }>;
  targetResourceScope?: string;
}): {
  allowedPermissions: Set<string>;
  deniedPermissions: Set<string>;
  effectiveList: string[];
} {
  const { role, customRoleId, overrides = [], targetResourceScope = "*" } = params;

  const roleDef = customRoleId ? getRoleDefinition(customRoleId) : getRoleDefinition(role);
  const basePermissions = new Set<string>(roleDef?.permissions || []);

  const allowed = new Set<string>();
  const denied = new Set<string>();

  // Start with base role grants
  for (const perm of basePermissions) {
    allowed.add(perm);
  }

  // Apply explicit overrides (DENY strictly takes precedence over ALLOW)
  for (const override of overrides) {
    const scopeMatch =
      !override.resourceScope ||
      override.resourceScope === "*" ||
      override.resourceScope === targetResourceScope;

    if (scopeMatch) {
      if (override.effect === "DENY") {
        denied.add(override.permissionId);
        allowed.delete(override.permissionId);
      } else if (override.effect === "ALLOW" && !denied.has(override.permissionId)) {
        allowed.add(override.permissionId);
      }
    }
  }

  return {
    allowedPermissions: allowed,
    deniedPermissions: denied,
    effectiveList: Array.from(allowed),
  };
}
