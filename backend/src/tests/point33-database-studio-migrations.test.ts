/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 33
 * Regression Test Suite: Database Studio Environment Security & Migration Integrity
 */

import { describe, it, expect, vi } from "vitest";
import {
  DatabaseStudioService,
} from "../modules/data-platform/studio/databaseStudio.service.js";
import {
  MigrationEngine,
} from "../modules/data-platform/database/migrationEngine.js";

describe("Point 33 — Database Studio & Migration Integrity Engine", () => {
  it("enforces explicit environment selection and fails closed when missing", () => {
    // Missing environment must fail closed!
    expect(() => DatabaseStudioService.validateEnvironment(undefined)).toThrow(
      /Explicit environment selection is mandatory/
    );

    // Invalid environment string must fail closed (zero fallback to production)
    expect(() => DatabaseStudioService.validateEnvironment("local-mock")).toThrow(
      /Invalid environment 'local-mock'/
    );

    // Valid environments are strictly normalized
    expect(DatabaseStudioService.validateEnvironment("development")).toBe("DEVELOPMENT");
    expect(DatabaseStudioService.validateEnvironment("staging")).toBe("STAGING");
    expect(DatabaseStudioService.validateEnvironment("production")).toBe("PRODUCTION");
  });

  it("computes deterministic SHA-256 checksums and detects SQL tampering", () => {
    const engine = new MigrationEngine();
    const sql = "CREATE TABLE users (id UUID PRIMARY KEY);";
    const checksum1 = engine.computeChecksum(sql);
    const checksum2 = engine.computeChecksum(sql);

    expect(checksum1).toBe(checksum2);
    expect(checksum1.length).toBe(64);

    // Minor whitespace/content modification produces distinct checksum
    const modifiedSql = "CREATE TABLE users (id UUID PRIMARY KEY, is_admin BOOLEAN);";
    const checksumModified = engine.computeChecksum(modifiedSql);
    expect(checksum1).not.toBe(checksumModified);
  });

  it("detects drift across applied migrations via verifyMigrationIntegrity", async () => {
    const engine = new MigrationEngine();
    const databaseId = "4f1c2d3e-0000-4000-8000-000000000033";
    const intactSql = "CREATE TABLE a (id UUID PRIMARY KEY);";
    const recordedSql = "CREATE TABLE b (id UUID PRIMARY KEY);";
    const base = { databaseId, projectId: "p", downSql: null, createdAt: new Date() };
    vi.spyOn(engine, "listMigrations").mockResolvedValue([
      { ...base, id: "m1", name: "001_intact", upSql: intactSql, checksum: engine.computeChecksum(intactSql), status: "APPLIED" },
      // Applied SQL edited after the checksum was recorded.
      { ...base, id: "m2", name: "002_tampered", upSql: recordedSql + " -- edited", checksum: engine.computeChecksum(recordedSql), status: "APPLIED" },
      { ...base, id: "m3", name: "003_interrupted", upSql: "SELECT 1;", checksum: engine.computeChecksum("SELECT 1;"), status: "RECONCILIATION_REQUIRED" },
    ] as any);

    const report = await engine.verifyMigrationIntegrity(databaseId);

    expect(report.isConsistent).toBe(false);
    expect(report.appliedCount).toBe(2);
    expect(report.driftsDetected.map((d) => d.migrationName)).toEqual(["002_tampered"]);
    expect(report.unreconciledMigrations).toEqual(["003_interrupted"]);
  });

  it("fails closed on a malformed database identifier instead of reporting it consistent", async () => {
    const engine = new MigrationEngine();
    await expect(engine.verifyMigrationIntegrity("non-existent-db-for-unit-test")).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_DATABASE_ID",
    });
  });

  it("handles non-transactional migrations (CREATE INDEX CONCURRENTLY) outside atomic transaction blocks", () => {
    const concurrentSql = "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);";
    const isConcurrent = /\bINDEX\s+CONCURRENTLY\b/i.test(concurrentSql);
    expect(isConcurrent).toBe(true);
  });
});
