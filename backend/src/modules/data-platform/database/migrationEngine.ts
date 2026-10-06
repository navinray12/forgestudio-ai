/**
 * ForgeStudio Module 25: Database Migration Engine
 * Serializes, validates, applies, and rolls back customer database migrations with advisory locks.
 */

import crypto from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { customerConnectionManager } from "./connectionManager.js";
import { MigrationRecord } from "./database.types.js";

const db = prisma as any;

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
    return await db.forgeDatabaseMigration.findMany({
      where: { databaseId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Apply a specific pending migration using an atomic transaction and PostgreSQL advisory lock
   */
  public async applyMigration(databaseId: string, migrationId: string): Promise<MigrationRecord> {
    const migration = await db.forgeDatabaseMigration.findUnique({
      where: { id: migrationId },
    });
    if (!migration) throw new AppError("Migration not found", 404, "MIGRATION_NOT_FOUND");
    if (migration.status === "APPLIED") {
      throw new AppError("Migration has already been applied", 400, "MIGRATION_ALREADY_APPLIED");
    }

    const database = await db.forgeDatabase.findUnique({ where: { id: databaseId } });
    if (!database) throw new AppError("Database not found", 404, "DATABASE_NOT_FOUND");

    const schemaName = database.schemaName;
    const startTime = Date.now();

    // Acquire lock and execute inside transaction
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
          await client.query("BEGIN;");

          // Execute migration SQL
          await client.query(migration.upSql);

          // Record inside customer's internal _forge_migrations table
          await client.query(
            `INSERT INTO _forge_migrations (name, checksum, execution_time_ms, applied_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (name) DO UPDATE SET checksum = $2, applied_at = now();`,
            [migration.name, migration.checksum, Date.now() - startTime]
          );

          await client.query("COMMIT;");
        } catch (execErr) {
          await client.query("ROLLBACK;");
          throw execErr;
        } finally {
          await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
        }
      });

      const durationMs = Date.now() - startTime;
      const updated = await db.forgeDatabaseMigration.update({
        where: { id: migrationId },
        data: {
          status: "APPLIED",
          executionTimeMs: durationMs,
          appliedAt: new Date(),
          errorMessage: null,
        },
      });

      return updated;
    } catch (err: any) {
      await db.forgeDatabaseMigration.update({
        where: { id: migrationId },
        data: {
          status: "FAILED",
          errorMessage: err.message || "Migration execution failed",
        },
      });
      throw new AppError(`Migration failed: ${err.message}`, 500, "MIGRATION_FAILED");
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
