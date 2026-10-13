/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 33
 * Module 25: Database Migration Engine with Integrity, Verification & Recovery
 *
 * Enforces:
 * 1. Target binding: Validates that every migration belongs to authorized project, tenant, and exact database.
 * 2. Checksum verification: Validates checksums before execution and detects drift across applied migrations.
 * 3. Environment binding: Strict environment resolution (DEVELOPMENT, STAGING, PRODUCTION).
 * 4. Non-transactional migration support: Safe execution of DDL like CREATE INDEX CONCURRENTLY outside BEGIN blocks.
 * 5. Control-plane reconciliation: DDL success followed by control-plane write failure does NOT produce a false FAILED/PENDING status.
 * 6. Forward-recovery & operator reconciliation when rollback is unsafe.
 */

import crypto from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { MigrationRecord } from "./database.types.js";

const db = prisma as any;

export interface MigrationExecutionOptions {
  environment?: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
  projectId?: string;
  tenantId?: string;
  runInTransaction?: boolean;
}

export interface MigrationIntegrityReport {
  databaseId: string;
  isConsistent: boolean;
  appliedCount: number;
  driftsDetected: Array<{ migrationName: string; recordedChecksum: string; computedChecksum: string }>;
  unreconciledMigrations: string[];
}

export class MigrationEngine {
  /**
   * Compute sha256 checksum of SQL content
   */
  public computeChecksum(sql: string): string {
    return crypto.createHash("sha256").update(sql.trim()).digest("hex");
  }

  /**
   * Register a new pending migration
   */
  public async createMigration(
    databaseId: string,
    projectId: string,
    name: string,
    upSql: string,
    downSql?: string
  ): Promise<MigrationRecord> {
    if (!name || !upSql) {
      throw new AppError("Migration name and upSql are required", 400, "INVALID_MIGRATION");
    }

    const checksum = this.computeChecksum(upSql);
    const migration = await db.forgeDatabaseMigration.create({
      data: {
        databaseId,
        projectId,
        name,
        upSql,
        downSql: downSql || null,
        checksum,
        status: "PENDING",
      },
    });

    return migration;
  }

  /**
   * List all migrations for a customer database
   */
  public async listMigrations(databaseId: string): Promise<MigrationRecord[]> {
    // Fail closed on malformed identifiers instead of surfacing a raw driver error
    // (or, worse, reporting an unknown database as consistent).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
      throw new AppError("Invalid database identifier", 400, "INVALID_DATABASE_ID");
    }
    return await db.forgeDatabaseMigration.findMany({
      where: { databaseId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Verify integrity and detect checksum drift across all applied migrations
   */
  public async verifyMigrationIntegrity(databaseId: string): Promise<MigrationIntegrityReport> {
    const migrations = await this.listMigrations(databaseId);
    const applied = migrations.filter((m) => m.status === "APPLIED");
    const driftsDetected: MigrationIntegrityReport["driftsDetected"] = [];
    const unreconciledMigrations: string[] = [];

    for (const m of applied) {
      const currentChecksum = this.computeChecksum(m.upSql);
      if (currentChecksum !== m.checksum) {
        driftsDetected.push({
          migrationName: m.name,
          recordedChecksum: m.checksum,
          computedChecksum: currentChecksum,
        });
      }
    }

    for (const m of migrations) {
      if (["RECONCILIATION_REQUIRED", "UNCERTAIN", "PARTIALLY_APPLIED", "RECOVERY_REQUIRED", "APPLYING", "VALIDATING"].includes(m.status as string)) {
        unreconciledMigrations.push(m.name);
      }
    }

    return {
      databaseId,
      isConsistent: driftsDetected.length === 0 && unreconciledMigrations.length === 0,
      appliedCount: applied.length,
      driftsDetected,
      unreconciledMigrations,
    };
  }

  /**
   * Applies a migration through the migration authority (preflight, dual rehearsal, approval,
   * fenced execution, evidence). This engine no longer sends DDL itself: there is one execution
   * path. For a PRODUCTION database the run stops after the rehearsal and reports that an explicit
   * approval is required.
   */
  public async applyMigration(
    databaseId: string,
    migrationId: string,
    options: MigrationExecutionOptions & { actor?: { id: string; canAdminister?: boolean } } = {}
  ): Promise<MigrationRecord> {
    const { unifiedMigrationAuthority } = await import("../../../services/migration/unifiedMigrationAuthority.service.js");
    const result = await unifiedMigrationAuthority.runGoverned(
      migrationId,
      options.actor ?? { id: "00000000-0000-0000-0000-000000000000" },
      { databaseId, projectId: options.projectId, environment: options.environment }
    );
    if (result.approvalRequired) {
      throw new AppError(
        "This is a production database: the migration was checked and rehearsed, and now needs an explicit approval before it can be executed.",
        409,
        "APPROVAL_REQUIRED"
      );
    }
    return result.migration as unknown as MigrationRecord;
  }

  /** Resolves a migration whose outcome is unknown by inspecting the target database. Runs no DDL. */
  public async reconcileMigrationState(databaseId: string, migrationId: string): Promise<MigrationRecord> {
    const { unifiedMigrationAuthority } = await import("../../../services/migration/unifiedMigrationAuthority.service.js");
    return (await unifiedMigrationAuthority.reconcile(migrationId, { databaseId })) as unknown as MigrationRecord;
  }

  /**
   * Reverts an applied migration by running its down SQL as a new governed plan, so the revert
   * passes the same checks and rehearsals as any other change. Production is not reverted this
   * way: a production revert is a forward-fix plan with its own explicit approval.
   */
  public async rollbackMigration(
    databaseId: string,
    migrationId: string,
    options: { actor?: { id: string; canAdminister?: boolean } } = {}
  ): Promise<MigrationRecord> {
    const { unifiedMigrationAuthority, normalizeEnvironment } = await import("../../../services/migration/unifiedMigrationAuthority.service.js");
    const migration = await db.forgeDatabaseMigration.findUnique({ where: { id: migrationId } });
    if (!migration) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    if (migration.databaseId !== databaseId) {
      throw new AppError("Migration does not belong to the target database", 403, "MIGRATION_TARGET_MISMATCH");
    }
    if (migration.status !== "APPLIED") throw new AppError("Only applied migrations can be rolled back", 400, "CANNOT_ROLLBACK");
    if (!migration.downSql) throw new AppError("Migration does not contain a downSql definition", 400, "NO_DOWN_SQL");
    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");
    if (normalizeEnvironment(database.environment) === "PRODUCTION") {
      throw new AppError("A production migration is not rolled back automatically; create and approve a forward-fix plan.", 409, "ROLLBACK_REQUIRES_FORWARD_FIX");
    }
    // One statement per line-terminated ";" (the form down SQL is stored in).
    const statements = String(migration.downSql).split(/;[ \t]*(?:\r?\n|$)/).map((part: string) => part.trim()).filter(Boolean);
    const plan = await unifiedMigrationAuthority.createPlan({
      databaseId,
      projectId: migration.projectId,
      name: `${String(migration.name).slice(0, 150)}__revert_${crypto.randomBytes(3).toString("hex")}`,
      statements,
      reverts: migrationId,
      createdById: options.actor?.id ?? null,
    });
    await unifiedMigrationAuthority.runGoverned(plan.id, options.actor ?? { id: "00000000-0000-0000-0000-000000000000" }, { databaseId });
    return await db.forgeDatabaseMigration.findUnique({ where: { id: migrationId } });
  }
}

export const migrationEngine = new MigrationEngine();
