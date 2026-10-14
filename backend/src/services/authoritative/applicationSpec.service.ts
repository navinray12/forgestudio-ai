/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 33
 * ApplicationSpec: Independent Domain Contract
 *
 * Authority: Application domain models, transactional entities, typed operations,
 * security boundaries, business invariants, and API bindings.
 *
 * Kept strictly separate from:
 * - SiteSpec: visual layout, tokens, route references, visual bindings
 * - SourceManifest: source identity, hashes, ownership, source maps
 * - PageRegistry: page/file/route/export associations and projection state
 * - SchemaPlan: proposed DDL/data transformations and compatibility requirements
 * - EnvironmentBinding: project, environment, runtime, domain, database target identity
 * - WorkspaceCheckpoint: compatible immutable references across specifications
 *
 * Invariants:
 * 1. Must NEVER store raw credentials, grant production approval, or store customer rows.
 * 2. CMS collection definitions remain separate from transactional application models.
 * 3. Stable entity and field identities preserved across physical table renames.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export const APPLICATIONSPEC_SCHEMA_VERSION = "1.0.0";

export type FrameworkProfile =
  | "nextjs-app-router"
  | "react-vite"
  | "node-express"
  | "nestjs-postgresql";

export type TenancyStrategy =
  | "MULTI_TENANT_ROW"
  | "MULTI_TENANT_SCHEMA"
  | "SINGLE_TENANT_DEDICATED";

export type FieldDataType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "datetime"
  | "json"
  | "uuid"
  | "enum";

export type FieldSensitivity =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED_PII";

export type FieldVisibility =
  | "READ_WRITE"
  | "READ_ONLY"
  | "WRITE_ONLY"
  | "HIDDEN";

export type LifecycleOwnership =
  | "SYSTEM"
  | "USER"
  | "GENERATED";

export interface ApplicationField {
  id: string; // Stable field ID (e.g. fld_xxx)
  name: string;
  physicalColumnName: string;
  type: FieldDataType;
  isNullable: boolean;
  defaultValue?: any;
  sensitivity: FieldSensitivity;
  visibility: FieldVisibility;
  lifecycleOwnership: LifecycleOwnership;
  description?: string;
  enumOptions?: string[];
  validationRules?: {
    min?: number;
    max?: number;
    pattern?: string;
    customRule?: string;
  };
}

export interface ApplicationEntity {
  id: string; // Stable entity ID (e.g. ent_xxx)
  name: string;
  physicalTableName: string;
  description?: string;
  isSoftDeletable: boolean;
  isAudited: boolean;
  fields: ApplicationField[];
  indexes?: Array<{
    name: string;
    fields: string[];
    isUnique: boolean;
  }>;
}

export type RelationshipType =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_MANY";

export type CascadeRule =
  | "CASCADE"
  | "SET_NULL"
  | "RESTRICT_NO_ACTION";

export interface ApplicationRelationship {
  id: string; // Stable relationship ID (e.g. rel_xxx)
  name: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  foreignKeyField: string;
  cascadeRule: CascadeRule;
}

export type OperationType = "QUERY" | "MUTATION";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApplicationOperation {
  id: string; // Stable operation ID (e.g. op_xxx)
  name: string;
  type: OperationType;
  method: HttpMethod;
  routePath: string;
  summary: string;
  targetEntityId?: string;
  requiredScopes: string[];
  transactionBoundary: "ATOMIC_TRANSACTION" | "SINGLE_STATEMENT" | "NONE";
  requiresIdempotencyKey: boolean;
  declaredSideEffects: string[];
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface ApplicationActor {
  id: string;
  name: string;
  description: string;
  assignedRoles: string[];
  isDefault: boolean;
}

export interface ApplicationSecurityPolicy {
  id: string;
  name: string;
  actorId: string;
  resourceEntityId: string;
  effect: "ALLOW" | "DENY";
  actions: Array<"CREATE" | "READ" | "UPDATE" | "DELETE" | "EXECUTE">;
  constraintExpression?: string; // e.g. "record.tenantId == actor.tenantId"
}

export interface ApplicationFrontendBinding {
  id: string;
  operationId: string;
  hookName: string; // e.g. "useProductList"
  targetRoutePath: string;
  componentRef?: string;
}

export interface ApplicationJob {
  id: string;
  name: string;
  triggerType: "SCHEDULED_CRON" | "EVENT_DRIVEN";
  cronExpression?: string;
  eventTopic?: string;
  targetOperationId?: string;
  timeoutSeconds: number;
}

export interface ApplicationRetentionPolicy {
  entityId: string;
  retentionDays: number;
  archiveStrategy: "SOFT_DELETE_PURGE" | "COLD_STORAGE" | "ANONYMIZE";
  legalBasis: string;
}

export interface ApplicationAcceptanceContract {
  id: string;
  name: string;
  requirementId: string;
  expectedBehavior: string;
  testSuiteRef?: string;
}

export interface ApplicationSpec {
  schemaVersion: string;
  applicationId: string;
  projectId: string;
  tenantId: string;
  revision: number;
  parentRevision: number;
  frameworkProfile: FrameworkProfile;
  identityStrategy: TenancyStrategy;
  requirementIds: string[];
  entities: ApplicationEntity[];
  relationships: ApplicationRelationship[];
  operations: ApplicationOperation[];
  actors: ApplicationActor[];
  policies: ApplicationSecurityPolicy[];
  frontendBindings: ApplicationFrontendBinding[];
  jobs: ApplicationJob[];
  retentionPolicies: ApplicationRetentionPolicy[];
  acceptanceContracts: ApplicationAcceptanceContract[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validatedAt: string;
}

export class ApplicationSpecService {
  /** In-memory durable store indexed by applicationId and revision */
  private static specStore = new Map<string, ApplicationSpec[]>();

  /**
   * Validate ApplicationSpec invariants
   */
  public static validateApplicationSpec(spec: ApplicationSpec): ApplicationSpecValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!spec.applicationId) errors.push("applicationId is required");
    if (!spec.projectId) errors.push("projectId is required");
    if (!spec.tenantId) errors.push("tenantId is required");
    if (typeof spec.revision !== "number" || spec.revision < 1) {
      errors.push("revision must be a positive integer");
    }

    // Invariant 1: Must NOT contain raw credentials or customer row storage.
    // Each string value is scanned as-is: scanning JSON.stringify output would
    // see escaped quotes (\") and never match a quoted assignment.
    const forbiddenCredentialPatterns = [
      /password\s*[:=]\s*["'][^"']+["']/i,
      /client_secret\s*[:=]\s*["'][^"']+["']/i,
      /private_key\s*[:=]\s*["'][^"']+["']/i,
      /api_key\s*[:=]\s*["'][a-zA-Z0-9_\-]{16,}["']/i,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ];
    const stringValues: string[] = [];
    const collectStrings = (value: unknown, depth: number): void => {
      if (depth > 32 || value == null) return;
      if (typeof value === "string") stringValues.push(value);
      else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, depth + 1));
      else if (typeof value === "object") Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, depth + 1));
    };
    collectStrings(spec, 0);
    if (stringValues.some((text) => forbiddenCredentialPatterns.some((pattern) => pattern.test(text)))) {
      errors.push("ApplicationSpec must never contain raw credentials or private secrets.");
    }

    // Invariant 2: Entity & Field Identifiers must be stable and prefixed
    const entityIds = new Set<string>();
    const entityNames = new Set<string>();

    for (const entity of spec.entities || []) {
      if (!entity.id || !entity.id.startsWith("ent_")) {
        errors.push(`Entity '${entity.name}' has invalid ID '${entity.id}'. Must start with 'ent_'.`);
      }
      if (entityIds.has(entity.id)) {
        errors.push(`Duplicate entity ID '${entity.id}' detected.`);
      }
      entityIds.add(entity.id);

      if (entityNames.has(entity.name.toLowerCase())) {
        errors.push(`Duplicate entity name '${entity.name}' detected.`);
      }
      entityNames.add(entity.name.toLowerCase());

      const fieldIds = new Set<string>();
      const fieldNames = new Set<string>();
      const physicalColumns = new Set<string>();
      for (const field of entity.fields || []) {
        if (!field.id || !field.id.startsWith("fld_")) {
          errors.push(`Field '${field.name}' in entity '${entity.name}' must have stable ID starting with 'fld_'.`);
        }
        if (fieldIds.has(field.id)) {
          errors.push(`Duplicate field ID '${field.id}' in entity '${entity.name}'.`);
        }
        fieldIds.add(field.id);
        const logicalName = field.name.toLowerCase();
        const physicalName = field.physicalColumnName.toLowerCase();
        if (fieldNames.has(logicalName)) {
          errors.push(`Duplicate field name '${field.name}' in entity '${entity.name}'.`);
        }
        if (physicalColumns.has(physicalName)) {
          errors.push(`Duplicate physical column '${field.physicalColumnName}' in entity '${entity.name}'.`);
        }
        fieldNames.add(logicalName);
        physicalColumns.add(physicalName);
      }
    }

    // Invariant 3: Relationships must resolve to valid declared entities
    for (const rel of spec.relationships || []) {
      if (!entityIds.has(rel.sourceEntityId)) {
        errors.push(`Relationship '${rel.name}' references non-existent sourceEntityId '${rel.sourceEntityId}'.`);
      }
      if (!entityIds.has(rel.targetEntityId)) {
        errors.push(`Relationship '${rel.name}' references non-existent targetEntityId '${rel.targetEntityId}'.`);
      }
      const source = spec.entities.find((entity) => entity.id === rel.sourceEntityId);
      if (source && !source.fields.some((field) => field.id === rel.foreignKeyField || field.name === rel.foreignKeyField || field.physicalColumnName === rel.foreignKeyField)) {
        errors.push(`Relationship '${rel.name}' references unknown foreignKeyField '${rel.foreignKeyField}'.`);
      }
    }

    // Invariant 4: Tenancy enforcement - All entities must support tenant scoping under MULTI_TENANT strategies
    if (spec.identityStrategy === "MULTI_TENANT_ROW") {
      for (const entity of spec.entities || []) {
        const hasTenantField = entity.fields.some(
          (f) => f.name.toLowerCase() === "tenantid" || f.physicalColumnName.toLowerCase() === "tenant_id"
        );
        if (!hasTenantField) {
          errors.push(`Entity '${entity.name}' must declare a tenantId field under MULTI_TENANT_ROW strategy.`);
        }
      }
    }

    // Invariant 5: Operations must have valid route paths and declared transaction boundaries
    const opIds = new Set<string>();
    for (const op of spec.operations || []) {
      if (!op.id || !op.id.startsWith("op_")) {
        errors.push(`Operation '${op.name}' must have stable ID starting with 'op_'.`);
      }
      if (opIds.has(op.id)) {
        errors.push(`Duplicate operation ID '${op.id}' detected.`);
      }
      opIds.add(op.id);

      if (!op.routePath.startsWith("/")) {
        errors.push(`Operation '${op.name}' routePath must start with '/'`);
      }
    }

    // Prevent unresolved or misdirected authorization and UI bindings from
    // becoming part of a supposedly valid application contract.
    const actorIds = new Set((spec.actors || []).map((actor) => actor.id));
    for (const policy of spec.policies || []) {
      if (!actorIds.has(policy.actorId)) {
        errors.push(`Policy '${policy.name}' references unknown actorId '${policy.actorId}'.`);
      }
      if (!entityIds.has(policy.resourceEntityId)) {
        errors.push(`Policy '${policy.name}' references unknown resourceEntityId '${policy.resourceEntityId}'.`);
      }
    }
    for (const binding of spec.frontendBindings || []) {
      if (!opIds.has(binding.operationId)) {
        errors.push(`Frontend binding '${binding.id}' references unknown operationId '${binding.operationId}'.`);
      }
    }
    for (const op of spec.operations || []) {
      if (op.targetEntityId && !entityIds.has(op.targetEntityId)) {
        errors.push(`Operation '${op.name}' references unknown targetEntityId '${op.targetEntityId}'.`);
      }
    }
    for (const retention of spec.retentionPolicies || []) {
      if (!entityIds.has(retention.entityId)) {
        errors.push(`Retention policy references unknown entityId '${retention.entityId}'.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Deterministic SHA-256 digest of an ApplicationSpec
   */
  public static computeDigest(spec: ApplicationSpec): string {
    // The release identity must cover the ENTIRE authoritative spec, including
    // policies, relationships, job behavior, retention, bindings and defaults.
    // Sorting object keys makes logically identical JSON inputs hash identically;
    // array order remains part of the explicit contract.
    const canonical = JSON.stringify(spec, (_key, value: unknown) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        );
      }
      return value;
    });

    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Commit a new revision of an ApplicationSpec with optimistic concurrency validation
   */
  public static async commitRevision(spec: ApplicationSpec): Promise<{
    success: boolean;
    revision: number;
    digest: string;
    spec: ApplicationSpec;
  }> {
    const validation = this.validateApplicationSpec(spec);
    if (!validation.valid) {
      throw new AppError(
        `ApplicationSpec validation failed: ${validation.errors.join("; ")}`,
        422,
        "INVALID_APPLICATION_SPEC"
      );
    }

    const history = this.specStore.get(spec.applicationId) || [];
    const latest = history[history.length - 1];

    if (!latest) {
      // A new application must start from the genesis checkpoint; accepting an
      // arbitrary later revision would create an unverifiable history gap.
      if (spec.revision !== 1 || spec.parentRevision !== 0) {
        throw new AppError(
          "The initial application revision must be 1 with parentRevision 0",
          400,
          "INVALID_INITIAL_REVISION"
        );
      }
    }

    if (latest) {
      // The application ID is one authority: never let a subsequent revision
      // silently move that authority across projects or tenant boundaries.
      if (spec.projectId !== latest.projectId || spec.tenantId !== latest.tenantId) {
        throw new AppError(
          "Application revision cannot change its project or tenant ownership",
          409,
          "APPLICATION_OWNERSHIP_CONFLICT"
        );
      }
      if (spec.applicationId !== latest.applicationId) {
        throw new AppError("Application identity cannot change across revisions", 409, "APPLICATION_IDENTITY_CONFLICT");
      }
      if (spec.parentRevision !== latest.revision) {
        throw new AppError(
          `Revision conflict: expected parent revision ${latest.revision}, but received ${spec.parentRevision}`,
          409,
          "REVISION_CONFLICT"
        );
      }
      if (spec.revision !== latest.revision + 1) {
        throw new AppError(
          `Invalid revision sequence: expected ${latest.revision + 1}, received ${spec.revision}`,
          400,
          "INVALID_REVISION_SEQUENCE"
        );
      }
    }

    const digest = this.computeDigest(spec);
    // Store an independent snapshot; callers must not be able to mutate the
    // accepted revision (or a subsequent release's approval evidence).
    const snapshot = structuredClone(spec);
    history.push(snapshot);
    this.specStore.set(spec.applicationId, history);

    return {
      success: true,
      revision: spec.revision,
      digest,
      spec: structuredClone(snapshot),
    };
  }

  /**
   * Retrieve the latest revision of an ApplicationSpec
   */
  public static getLatestSpec(applicationId: string): ApplicationSpec | null {
    const history = this.specStore.get(applicationId);
    if (!history || history.length === 0) return null;
    return structuredClone(history[history.length - 1]);
  }

  /**
   * Diff two ApplicationSpec revisions to compute change impact
   */
  public static diffSpecs(oldSpec: ApplicationSpec, newSpec: ApplicationSpec) {
    const oldEntities = new Map(oldSpec.entities.map((e) => [e.id, e]));
    const newEntities = new Map(newSpec.entities.map((e) => [e.id, e]));

    const addedEntities = newSpec.entities.filter((e) => !oldEntities.has(e.id));
    const removedEntities = oldSpec.entities.filter((e) => !newEntities.has(e.id));
    const modifiedEntities: Array<{ id: string; name: string; changes: string[] }> = [];

    for (const [id, newEntity] of newEntities.entries()) {
      const oldEntity = oldEntities.get(id);
      if (oldEntity) {
        const changes: string[] = [];
        if (oldEntity.name !== newEntity.name) changes.push(`Name changed: ${oldEntity.name} -> ${newEntity.name}`);
        if (oldEntity.physicalTableName !== newEntity.physicalTableName) {
          changes.push(`Table changed: ${oldEntity.physicalTableName} -> ${newEntity.physicalTableName}`);
        }
        if (oldEntity.fields.length !== newEntity.fields.length) {
          changes.push(`Field count changed: ${oldEntity.fields.length} -> ${newEntity.fields.length}`);
        }
        if (changes.length > 0) {
          modifiedEntities.push({ id, name: newEntity.name, changes });
        }
      }
    }

    return {
      addedEntities,
      removedEntities,
      modifiedEntities,
      hasBreakingChanges: removedEntities.length > 0,
    };
  }
}
