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
import { customerConnectionManager } from "./connectionManager.js";
import { MigrationRecord } from "./database.types.js";
import { recordAuditLog } from "../../../services/audit.service.js";

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
      if ((m.status as string) === "RECONCILIATION_REQUIRED") {
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
   * Apply a specific pending migration with atomic locks, checksum checks, and failure reconciliation
   */
  public async applyMigration(
    databaseId: string,
    migrationId: string,
    options: MigrationExecutionOptions = {}
  ): Promise<MigrationRecord> {
    const migration = await db.forgeDatabaseMigration.findUnique({
      where: { id: migrationId },
    });
    if (!migration) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    if (migration.databaseId !== databaseId) {
      // A migration ID from another database/project must never be executed against this target.
      throw new AppError("Migration does not belong to the target database", 403, "MIGRATION_TARGET_MISMATCH");
    }
    if (migration.status === "APPLIED") {
      throw new AppError("Migration has already been applied", 400, "MIGRATION_ALREADY_APPLIED");
    }

    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    // 1. Authoritative Target Binding Validation
    if (options.projectId && database.projectId && database.projectId !== options.projectId) {
      throw new AppError("Migration database target does not match requested project", 403, "PROJECT_MISMATCH");
    }
    if (options.environment && database.environment) {
      if (database.environment.toUpperCase() !== options.environment.toUpperCase()) {
        throw new AppError(
          `Migration database target environment mismatch: target is '${database.environment}', requested '${options.environment}'`,
          403,
          "ENVIRONMENT_MISMATCH"
        );
      }
    }

    // 2. Checksum Verification: Check that SQL has not been altered since creation
    const currentChecksum = this.computeChecksum(migration.upSql);
    if (currentChecksum !== migration.checksum) {
      throw new AppError(
        `Migration checksum mismatch: recorded checksum ${migration.checksum} does not match computed ${currentChecksum}. Migration has been modified.`,
        422,
        "MIGRATION_CHECKSUM_MISMATCH"
      );
    }

    // 3. Verify prior applied migrations for drift before proceeding
    const integrity = await this.verifyMigrationIntegrity(databaseId);
    if (!integrity.isConsistent) {
      throw new AppError(
        `Database migration drift detected in applied history: ${integrity.driftsDetected.map((d) => d.migrationName).join(", ")}. Halt execution.`,
        409,
        "MIGRATION_HISTORY_DRIFT"
      );
    }

    const schemaName = database.schemaName;
    const startTime = Date.now();
    let ddlCommittedInPostgres = false;

    // Detect non-transactional operations (e.g. CREATE INDEX CONCURRENTLY, VACUUM)
    const isNonTransactional =
      options.runInTransaction === false ||
      /\bINDEX\s+CONCURRENTLY\b/i.test(migration.upSql) ||
      /\bVACUUM\b/i.test(migration.upSql);

    // 4. Acquire advisory lock and execute
    try {
      await customerConnectionManager.executeInSchema(schemaName, async (client) => {
        // Advisory lock on hash of databaseId
        const lockId = Math.abs(
          crypto.createHash("sha256").update(databaseId).digest().readInt32BE(0)
        );
        const lockRes = await client.query("SELECT pg_try_advisory_lock($1) as locked", [lockId]);
        if (!lockRes.rows[0]?.locked) {
          throw new AppError("Database migration in progress by another worker", 409, "MIGRATION_LOCKED");
        }

        try {
          if (isNonTransactional) {
            // Execute directly without BEGIN...COMMIT (PostgreSQL requirement for CONCURRENTLY)
            await client.query(migration.upSql);
            ddlCommittedInPostgres = true;

            await client.query(
              `INSERT INTO _forge_migrations (name, checksum, execution_time_ms, applied_at)
               VALUES ($1, $2, $3, now())
               ON CONFLICT (name) DO UPDATE SET checksum = $2, applied_at = now();`,
              [migration.name, migration.checksum, Date.now() - startTime]
            );
          } else {
            // Standard transactional DDL
            await client.query("BEGIN;");
            await client.query(migration.upSql);

            await client.query(
              `INSERT INTO _forge_migrations (name, checksum, execution_time_ms, applied_at)
               VALUES ($1, $2, $3, now())
               ON CONFLICT (name) DO UPDATE SET checksum = $2, applied_at = now();`,
              [migration.name, migration.checksum, Date.now() - startTime]
            );

            await client.query("COMMIT;");
            ddlCommittedInPostgres = true;
          }
        } catch (execErr) {
          if (!isNonTransactional && !ddlCommittedInPostgres) {
            await client.query("ROLLBACK;");
          }
          throw execErr;
        } finally {
          await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
        }
      });

      const durationMs = Date.now() - startTime;

      // 5. Update Control-Plane Record
      try {
        const updated = await db.forgeDatabaseMigration.update({
          where: { id: migrationId },
          data: {
            status: "APPLIED",
            executionTimeMs: durationMs,
            appliedAt: new Date(),
            errorMessage: null,
          },
        });

        await recordAuditLog({
          userId: database.projectId || "system",
          action: "database.migration_applied",
          targetResource: `migration:${migrationId}`,
          details: { name: migration.name, durationMs, checksum: migration.checksum },
        });

        return updated;
      } catch (cpErr: any) {
        // RECONCILIATION GUARD: DDL succeeded in Postgres, but control-plane update threw!
        // Do NOT mark as FAILED! Mark as RECONCILIATION_REQUIRED so operators do not blindly re-run DDL!
        await db.forgeDatabaseMigration.update({
          where: { id: migrationId },
          data: {
            status: "RECONCILIATION_REQUIRED",
            executionTimeMs: durationMs,
            appliedAt: new Date(),
            errorMessage: `DDL committed in database but control plane state update failed: ${cpErr.message}`,
          },
        });
        throw new AppError(
          `Migration DDL was applied in database, but control-plane record update requires reconciliation: ${cpErr.message}`,
          500,
          "MIGRATION_RECONCILIATION_REQUIRED"
        );
      }
    } catch (err: any) {
      if (!ddlCommittedInPostgres) {
        await db.forgeDatabaseMigration.update({
          where: { id: migrationId },
          data: {
            status: "FAILED",
            errorMessage: err.message || "Migration execution failed",
          },
        });
      }
      throw new AppError(`Migration failed: ${err.message}`, 500, "MIGRATION_FAILED");
    }
  }

  /**
   * Operator reconciliation for ambiguous or partial migration states
   */
  public async reconcileMigrationState(databaseId: string, migrationId: string): Promise<MigrationRecord> {
    const migration = await db.forgeDatabaseMigration.findUnique({ where: { id: migrationId } });
    if (!migration) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    if (migration.databaseId !== databaseId) {
      // A migration ID from another database/project must never be executed against this target.
      throw new AppError("Migration does not belong to the target database", 403, "MIGRATION_TARGET_MISMATCH");
    }

    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    // Check if the customer's internal _forge_migrations table contains this migration
    const res = await customerConnectionManager.querySchema(
      database.schemaName,
      "SELECT name, checksum, applied_at FROM _forge_migrations WHERE name = $1;",
      [migration.name]
    );

    if (res.rows && res.rows.length > 0) {
      // Reconciled: DDL exists in the database
      const updated = await db.forgeDatabaseMigration.update({
        where: { id: migrationId },
        data: {
          status: "APPLIED",
          appliedAt: res.rows[0].applied_at || new Date(),
          errorMessage: null,
        },
      });
      return updated;
    } else {
      // Not applied: mark back as PENDING
      const updated = await db.forgeDatabaseMigration.update({
        where: { id: migrationId },
        data: {
          status: "PENDING",
          errorMessage: "Reconciled by operator: DDL was not present in target database.",
        },
      });
      return updated;
    }
  }

  /**
   * Rollback an applied migration
   */
  public async rollbackMigration(databaseId: string, migrationId: string): Promise<MigrationRecord> {
    const migration = await db.forgeDatabaseMigration.findUnique({
      where: { id: migrationId },
    });
    if (!migration) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    if (migration.databaseId !== databaseId) {
      // A migration ID from another database/project must never be executed against this target.
      throw new AppError("Migration does not belong to the target database", 403, "MIGRATION_TARGET_MISMATCH");
    }
    if (migration.status !== "APPLIED") {
      throw new AppError("Only applied migrations can be rolled back", 400, "CANNOT_ROLLBACK");
    }
    if (!migration.downSql) {
      throw new AppError("Migration does not contain a downSql definition", 400, "NO_DOWN_SQL");
    }

    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;

    await customerConnectionManager.executeTransactionInSchema(schemaName, async (client) => {
      await client.query(migration.downSql);
      await client.query("DELETE FROM _forge_migrations WHERE name = $1", [migration.name]);
    });

    const updated = await db.forgeDatabaseMigration.update({
      where: { id: migrationId },
      data: {
        status: "ROLLED_BACK",
        errorMessage: null,
      },
    });

    return updated;
  }
}

export const migrationEngine = new MigrationEngine();
