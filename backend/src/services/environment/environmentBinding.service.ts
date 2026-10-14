/**
 * ForgeStudio Blueprint Point 42 — Environment Bindings, Secrets and Isolation
 * EnvironmentBindingService
 *
 * Implements the authoritative EnvironmentBinding contract:
 * - bindingId, version
 * - projectId, applicationId
 * - environmentClass: DEVELOPMENT | STAGING | PRODUCTION
 * - databaseProvider, engine, and profile
 * - targetFingerprint: hash identifying this binding version's target reference
 * - safeDisplayLabel: masked safe presentation label
 * - secretRef: indirect reference to secret vault key (NEVER raw connection strings or passwords)
 * - roles: runtimeRole, inspectionRole, migratorRole
 * - poolLimits: min, max, timeouts
 * - protectionLevel: SANDBOX | CONTROLLED_STAGING | RESTRICTED_PRODUCTION
 * - verificationHistory: records of checks that were actually performed (empty until one is)
 *
 * Bindings are persisted in forge_environment_bindings (one row per project and environment
 * class). There is no in-memory copy and no fallback: if the store is unavailable the operation
 * fails, and a lookup never creates a binding or resolves to a different environment.
 *
 * Enforces:
 * - Step-up authentication for production binding mutations.
 * - Absolute prohibition against raw passwords or credentials in UI / API returns.
 *
 * Callers are responsible for verifying project membership before calling this service
 * (the HTTP handlers do so with getForgeProjectById).
 */

import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";
import { withProjectRls } from "../../platform/tenancy/rls.js";
import { AppError } from "../../utils/app-error.js";

export type EnvironmentClass = "DEVELOPMENT" | "STAGING" | "PRODUCTION";
export type ProtectionLevel = "SANDBOX" | "CONTROLLED_STAGING" | "RESTRICTED_PRODUCTION";
export type BindingStatus = "ACTIVE" | "RETIRED";

export interface DatabaseRoleConfig {
  runtimeRole: string; // e.g. "app_runtime_user"
  inspectionRole: string; // e.g. "app_readonly_inspector"
  migratorRole: string; // e.g. "app_migration_admin"
}

export interface ConnectionPoolLimits {
  min: number;
  max: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface BindingVerificationRecord {
  verifiedAt: string;
  tlsActive: boolean;
  targetIdentityVerified: boolean;
  roleVerified: boolean;
  status: "VERIFIED" | "FAILED";
  evidenceNotes: string;
}

export interface EnvironmentBinding {
  bindingId: string;
  version: number;
  projectId: string;
  applicationId: string;
  environmentClass: EnvironmentClass;
  databaseProvider: "postgresql" | "cockroachdb" | "sqlite";
  targetFingerprint: string;
  safeDisplayLabel: string;
  secretRef: string; // Reference key into secret vault (NO raw password)
  roles: DatabaseRoleConfig;
  poolLimits: ConnectionPoolLimits;
  protectionLevel: ProtectionLevel;
  status: BindingStatus;
  verificationHistory: BindingVerificationRecord[];
  createdAt: string;
  updatedAt: string;
}

/** What an API may return: everything except the secret reference itself. */
export type PublicEnvironmentBinding = Omit<EnvironmentBinding, "secretRef"> & { secretRef: string; secretRefMasked: true };

export interface RegisterBindingOptions {
  provider?: "postgresql" | "cockroachdb" | "sqlite";
  secretRef: string;
  rawCredentialCheck?: string; // Passed to ensure NO raw credentials leak into secretRef
  roles?: Partial<DatabaseRoleConfig>;
  stepUpVerified?: boolean;
  /** Optimistic concurrency: the version the caller last saw (0 = expects no binding yet). */
  expectedVersion?: number;
  /** Authenticated user making the change, recorded on the row. */
  actorId?: string;
}

/** Persistence contract. A write returns the stored binding or null when the guard did not match. */
export interface EnvironmentBindingStore {
  find(projectId: string, envClass: EnvironmentClass): Promise<EnvironmentBinding | null>;
  list(projectId: string): Promise<EnvironmentBinding[]>;
  /**
   * Atomically creates version 1 or replaces the current row with version + 1, building the next
   * binding from the row it locked. Concurrent callers are serialized per project/environment.
   */
  upsert(
    projectId: string,
    envClass: EnvironmentClass,
    expectedVersion: number | undefined,
    actorId: string | undefined,
    build: (existing: EnvironmentBinding | null) => EnvironmentBinding
  ): Promise<EnvironmentBinding>;
  retire(projectId: string, envClass: EnvironmentClass, actorId: string | undefined): Promise<EnvironmentBinding | null>;
}

const ENVIRONMENT_CLASSES: EnvironmentClass[] = ["DEVELOPMENT", "STAGING", "PRODUCTION"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function fromRow(row: any): EnvironmentBinding {
  return {
    bindingId: row.bindingId,
    version: row.version,
    projectId: row.projectId,
    applicationId: row.applicationId,
    environmentClass: row.environmentClass,
    databaseProvider: row.databaseProvider,
    targetFingerprint: row.targetFingerprint,
    safeDisplayLabel: row.safeDisplayLabel,
    secretRef: row.secretRef,
    roles: row.roles,
    poolLimits: row.poolLimits,
    protectionLevel: row.protectionLevel,
    status: row.status,
    verificationHistory: row.verificationHistory ?? [],
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Store failures are reported as unavailable. The driver error is logged by code/message only:
 * it can never contain a secret reference because none is interpolated into SQL text.
 */
function storeError(err: any): never {
  if (err instanceof AppError) throw err;
  if (err?.code === "23503") throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  console.error("[environment bindings] store operation failed:", err?.code || "", err?.message || err);
  throw new AppError("Environment bindings are unavailable; nothing was changed", 503, "BINDING_STORE_UNAVAILABLE");
}

export class PostgresEnvironmentBindingStore implements EnvironmentBindingStore {
  constructor(private readonly pool: { query: (...args: any[]) => Promise<any>; connect: () => Promise<PoolClient> } = pgPool) {}

  /** A row-level-security transaction for the tenant that owns the project. */
  private inProject<T>(projectId: string, actorId: string | null | undefined, work: (db: PoolClient) => Promise<T>): Promise<T> {
    return withProjectRls(projectId, actorId, work, this.pool);
  }

  async find(projectId: string, envClass: EnvironmentClass): Promise<EnvironmentBinding | null> {
    if (!UUID.test(projectId)) return null;
    try {
      const { rows } = await this.inProject(projectId, null, (db) => db.query(
        `SELECT * FROM forge_environment_bindings WHERE "projectId" = $1::uuid AND "environmentClass" = $2`,
        [projectId, envClass]
      ));
      return rows[0] ? fromRow(rows[0]) : null;
    } catch (err) {
      return storeError(err);
    }
  }

  async list(projectId: string): Promise<EnvironmentBinding[]> {
    if (!UUID.test(projectId)) return [];
    try {
      const { rows } = await this.inProject(projectId, null, (db) => db.query(
        `SELECT * FROM forge_environment_bindings WHERE "projectId" = $1::uuid ORDER BY "environmentClass"`,
        [projectId]
      ));
      return rows.map(fromRow);
    } catch (err) {
      return storeError(err);
    }
  }

  async upsert(
    projectId: string,
    envClass: EnvironmentClass,
    expectedVersion: number | undefined,
    actorId: string | undefined,
    build: (existing: EnvironmentBinding | null) => EnvironmentBinding
  ): Promise<EnvironmentBinding> {
    if (!UUID.test(projectId)) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    try {
      return await this.inProject(projectId, actorId, async (client) => {
      // Serializes writers for this project/environment, including the first insert.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`environment-binding:${projectId}:${envClass}`]);
      const current = await client.query(
        `SELECT * FROM forge_environment_bindings WHERE "projectId" = $1::uuid AND "environmentClass" = $2 FOR UPDATE`,
        [projectId, envClass]
      );
      const existing = current.rows[0] ? fromRow(current.rows[0]) : null;
      if (expectedVersion !== undefined && expectedVersion !== (existing?.version ?? 0)) {
        throw new AppError(
          `The binding changed since it was read (current version ${existing?.version ?? 0})`,
          409,
          "BINDING_VERSION_CONFLICT"
        );
      }
      const next = build(existing);
      const params = [
        projectId, envClass, next.bindingId, next.version, next.applicationId, next.databaseProvider, next.targetFingerprint,
        next.safeDisplayLabel, next.secretRef, JSON.stringify(next.roles), JSON.stringify(next.poolLimits), next.protectionLevel,
        JSON.stringify(next.verificationHistory), actorId && UUID.test(actorId) ? actorId : null,
      ];
      const { rows } = existing
        ? await client.query(
            `UPDATE forge_environment_bindings SET "bindingId" = $3, version = $4, "applicationId" = $5, "databaseProvider" = $6,
                    "targetFingerprint" = $7, "safeDisplayLabel" = $8, "secretRef" = $9, roles = $10::jsonb, "poolLimits" = $11::jsonb,
                    "protectionLevel" = $12, "verificationHistory" = $13::jsonb, status = 'ACTIVE', "updatedById" = $14::uuid, "updatedAt" = now()
              WHERE "projectId" = $1::uuid AND "environmentClass" = $2 RETURNING *`,
            params
          )
        : await client.query(
            `INSERT INTO forge_environment_bindings ("projectId", "environmentClass", "bindingId", version, "applicationId", "databaseProvider",
                    "targetFingerprint", "safeDisplayLabel", "secretRef", roles, "poolLimits", "protectionLevel", "verificationHistory",
                    "createdById", "updatedById")
             VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14::uuid, $14::uuid) RETURNING *`,
            params
          );
      return fromRow(rows[0]);
      });
    } catch (err) {
      return storeError(err);
    }
  }

  async retire(projectId: string, envClass: EnvironmentClass, actorId: string | undefined): Promise<EnvironmentBinding | null> {
    if (!UUID.test(projectId)) return null;
    try {
      const { rows } = await this.inProject(projectId, actorId, (db) => db.query(
        `UPDATE forge_environment_bindings SET status = 'RETIRED', version = version + 1, "updatedById" = $3::uuid, "updatedAt" = now()
          WHERE "projectId" = $1::uuid AND "environmentClass" = $2 AND status = 'ACTIVE' RETURNING *`,
        [projectId, envClass, actorId && UUID.test(actorId) ? actorId : null]
      ));
      return rows[0] ? fromRow(rows[0]) : null;
    } catch (err) {
      return storeError(err);
    }
  }
}

/** Validates and normalizes an environment class. Never substitutes a default. */
export function requireEnvironmentClass(environmentClass: unknown): EnvironmentClass {
  if (!environmentClass || typeof environmentClass !== "string") {
    throw new AppError(
      "Explicit environmentClass selection is mandatory (DEVELOPMENT, STAGING, or PRODUCTION)",
      400,
      "MISSING_ENVIRONMENT"
    );
  }
  const upper = environmentClass.toUpperCase() as EnvironmentClass;
  if (!ENVIRONMENT_CLASSES.includes(upper)) {
    throw new AppError(
      `Invalid environment '${environmentClass}'. Allowed: DEVELOPMENT, STAGING, PRODUCTION. Zero fallback allowed.`,
      400,
      "INVALID_ENVIRONMENT"
    );
  }
  return upper;
}

/** API-safe view: the secret reference is masked so it cannot be copied out of a response or log. */
export function toPublicBinding(binding: EnvironmentBinding): PublicEnvironmentBinding {
  const ref = binding.secretRef;
  const scheme = ref.includes(":") ? ref.slice(0, ref.indexOf(":") + 1) : "";
  return { ...binding, secretRef: `${scheme}••••${ref.slice(-4)}`, secretRefMasked: true };
}

export class EnvironmentBindingService {
  constructor(private readonly store: EnvironmentBindingStore = new PostgresEnvironmentBindingStore()) {}

  /**
   * Register or update an EnvironmentBinding with security validation.
   * Each successful call produces the next version of the project's binding for that environment.
   */
  public async registerBinding(
    projectId: string,
    applicationId: string,
    envClass: EnvironmentClass,
    options: RegisterBindingOptions
  ): Promise<EnvironmentBinding> {
    envClass = requireEnvironmentClass(envClass);
    const secretRef = typeof options?.secretRef === "string" ? options.secretRef.trim() : "";
    if (!secretRef || secretRef.length > 300) {
      throw new AppError("secretRef must be a vault key reference of 1-300 characters", 400, "INVALID_SECRET_REF");
    }

    // SECURITY INVARIANT: Forbid raw connection strings or embedded passwords in secretRef
    if (/:\/\/.*:.*@/.test(secretRef) || secretRef.includes("password=")) {
      throw new AppError(
        "Raw credentials or connection strings must never be passed as secretRef. Provide a vault key reference.",
        400,
        "RAW_CREDENTIALS_FORBIDDEN"
      );
    }

    // Step-up verification required for PRODUCTION binding mutations
    if (envClass === "PRODUCTION" && !options.stepUpVerified) {
      throw new AppError(
        "Production environment binding mutations require step-up verification",
        403,
        "STEP_UP_VERIFICATION_REQUIRED"
      );
    }

    for (const role of Object.values(options.roles ?? {})) {
      if (role !== undefined && (typeof role !== "string" || !ROLE_NAME.test(role))) {
        throw new AppError("Database role names must be plain identifiers", 400, "INVALID_ROLE_NAME");
      }
    }
    const provider = options.provider || "postgresql";
    if (!["postgresql", "cockroachdb", "sqlite"].includes(provider)) {
      throw new AppError("Unsupported database provider", 400, "INVALID_PROVIDER");
    }
    if (typeof applicationId !== "string" || !applicationId || applicationId.length > 120) {
      throw new AppError("applicationId must be 1-120 characters", 400, "INVALID_APPLICATION_ID");
    }

    return this.store.upsert(projectId, envClass, options.expectedVersion, options.actorId, (existing) => {
      const nextVersion = existing ? existing.version + 1 : 1;
      const now = new Date().toISOString();
      return {
        bindingId: existing ? existing.bindingId : `bind_${projectId}_${envClass.toLowerCase()}`,
        version: nextVersion,
        projectId,
        applicationId,
        environmentClass: envClass,
        databaseProvider: provider,
        targetFingerprint: crypto
          .createHash("sha256")
          .update(`${projectId}:${envClass}:${secretRef}:${nextVersion}`)
          .digest("hex"),
        safeDisplayLabel: `db-${envClass.toLowerCase()} (${options.provider || "postgres"})`,
        secretRef,
        roles: {
          runtimeRole: options.roles?.runtimeRole || `app_${envClass.toLowerCase()}_runtime`,
          inspectionRole: options.roles?.inspectionRole || `app_${envClass.toLowerCase()}_readonly`,
          migratorRole: options.roles?.migratorRole || `app_${envClass.toLowerCase()}_migrator`,
        },
        poolLimits: {
          min: envClass === "PRODUCTION" ? 5 : 2,
          max: envClass === "PRODUCTION" ? 30 : 10,
          idleTimeoutMs: 10_000,
          connectionTimeoutMs: 5_000,
        },
        protectionLevel:
          envClass === "PRODUCTION" ? "RESTRICTED_PRODUCTION" : envClass === "STAGING" ? "CONTROLLED_STAGING" : "SANDBOX",
        status: "ACTIVE",
        // A new version points at a new secret reference that nothing has checked yet. Verification
        // records are appended only by a check that actually ran, never assumed at registration.
        verificationHistory: [],
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      };
    });
  }

  /**
   * Retrieve authoritative EnvironmentBinding.
   * Throws explicit error if environment is missing or invalid. ZERO fallback to production, and a
   * lookup never creates a binding: an unregistered or retired environment is "not found".
   */
  public async getBinding(projectId: string, environmentClass?: unknown): Promise<EnvironmentBinding> {
    const upper = requireEnvironmentClass(environmentClass);
    const binding = await this.store.find(projectId, upper);
    if (!binding || binding.status !== "ACTIVE") {
      throw new AppError(
        `No binding registered for project '${projectId}' in environment '${upper}'`,
        404,
        "BINDING_NOT_FOUND"
      );
    }
    return binding;
  }

  /** All bindings of a project, including retired ones. */
  public async listBindings(projectId: string): Promise<EnvironmentBinding[]> {
    return this.store.list(projectId);
  }

  /**
   * Retires a binding so it can no longer be resolved. The row is kept (and its version advanced, so
   * pools keyed by the old version are obsolete); registering again reactivates it as a new version.
   */
  public async retireBinding(
    projectId: string,
    environmentClass: unknown,
    options: { stepUpVerified?: boolean; actorId?: string } = {}
  ): Promise<EnvironmentBinding> {
    const upper = requireEnvironmentClass(environmentClass);
    if (upper === "PRODUCTION" && !options.stepUpVerified) {
      throw new AppError(
        "Production environment binding mutations require step-up verification",
        403,
        "STEP_UP_VERIFICATION_REQUIRED"
      );
    }
    const retired = await this.store.retire(projectId, upper, options.actorId);
    if (!retired) {
      throw new AppError(
        `No binding registered for project '${projectId}' in environment '${upper}'`,
        404,
        "BINDING_NOT_FOUND"
      );
    }
    return retired;
  }
}

export const environmentBindingService = new EnvironmentBindingService();
