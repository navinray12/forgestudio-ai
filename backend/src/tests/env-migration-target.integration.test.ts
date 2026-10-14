/**
 * FS21-AT-ENV-07 — Wrong-database migration ID (blueprint §43): a migration ID sent with another
 * project/environment/database is rejected before any DDL or metadata update.
 *
 * Uses real forge_projects / forge_databases / forge_database_migrations rows in the disposable
 * database and proves the negative with SQL: the migration row is untouched and its DDL never ran.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/env-migration-target.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("ENV-07: migration target ownership (disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");
  const { MigrationEngine } = await import("../modules/data-platform/database/migrationEngine.js");

  const marker = randomUUID().slice(0, 8);
  const probeTable = `env07_probe_${marker}`;
  const engine = new MigrationEngine();
  let userId = "";
  const project: Record<"a" | "b", string> = {} as any;
  const db: Record<"a" | "b", string> = {} as any;
  let migrationId = "";

  const q = async (sql: string, params: unknown[] = []) => (await pgPool.query(sql, params)).rows;
  const migrationRow = async () => (await q(`SELECT status, checksum, "appliedAt" FROM forge_database_migrations WHERE id = $1`, [migrationId]))[0];
  const probeExists = async () => (await q(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = $1`, [probeTable]))[0].n > 0;

  beforeAll(async () => {
    await ensureDatabaseTables();
    userId = (await prisma.user.create({ data: { fullName: "Env07", email: `env07-${marker}@example.test`, status: "ACTIVE" } })).id;
    for (const key of ["a", "b"] as const) {
      project[key] = (await createForgeProject({ name: `Env07 ${key} ${marker}`, ownerId: userId } as any)).id;
      db[key] = (await q(
        `INSERT INTO forge_databases ("projectId", environment, "schemaName") VALUES ($1, 'development', $2) RETURNING id`,
        [project[key], `env07_${key}_${marker}`]
      ))[0].id;
    }
    migrationId = (await engine.createMigration(db.b, project.b, "001_probe", `CREATE TABLE ${probeTable} (id INT);`)).id;
  }, 60_000);

  afterAll(async () => {
    await pgPool.query(`DELETE FROM forge_projects WHERE id = ANY($1::uuid[])`, [Object.values(project)]).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: `env07-${marker}@example.test` } }).catch(() => undefined);
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("rejects another database's migration ID before any DDL or metadata change", async () => {
    const before = await migrationRow();
    expect(before).toMatchObject({ status: "PENDING", appliedAt: null });

    await expect(engine.applyMigration(db.a, migrationId)).rejects.toMatchObject({ statusCode: 403, code: "MIGRATION_TARGET_MISMATCH" });
    await expect(engine.applyMigration(db.a, migrationId, { projectId: project.a, environment: "development" }))
      .rejects.toMatchObject({ code: "MIGRATION_TARGET_MISMATCH" });

    expect(await migrationRow()).toEqual(before);
    expect(await probeExists()).toBe(false);
  });

  it("rejects the right database under the wrong project or environment", async () => {
    const before = await migrationRow();
    await expect(engine.applyMigration(db.b, migrationId, { projectId: project.a })).rejects.toMatchObject({ statusCode: 403, code: "PROJECT_MISMATCH" });
    await expect(engine.applyMigration(db.b, migrationId, { projectId: project.b, environment: "production" }))
      .rejects.toMatchObject({ statusCode: 403, code: "ENVIRONMENT_MISMATCH" });
    await expect(engine.applyMigration("not-a-uuid", migrationId)).rejects.toMatchObject({ code: "MIGRATION_TARGET_MISMATCH" });

    expect(await migrationRow()).toEqual(before);
    expect(await probeExists()).toBe(false);
  });

  it("refuses SQL that was edited after its checksum was recorded", async () => {
    await q(`UPDATE forge_database_migrations SET "upSql" = $2 WHERE id = $1`, [migrationId, `CREATE TABLE ${probeTable} (id INT, injected TEXT);`]);
    await expect(engine.applyMigration(db.b, migrationId, { projectId: project.b, environment: "development" }))
      .rejects.toMatchObject({ statusCode: 422, code: "MIGRATION_CHECKSUM_MISMATCH" });
    expect((await migrationRow()).status).toBe("PENDING");
    expect(await probeExists()).toBe(false);
  });
});
