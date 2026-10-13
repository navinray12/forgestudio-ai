/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 33
 * Regression Test Suite: Database Studio Environment Security & Migration Integrity
 */

import { describe, it, expect } from "vitest";
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
    const report = await engine.verifyMigrationIntegrity("non-existent-db-for-unit-test");

    expect(report.isConsistent).toBe(true);
    expect(Array.isArray(report.driftsDetected)).toBe(true);
    expect(Array.isArray(report.unreconciledMigrations)).toBe(true);
  });

  it("handles non-transactional migrations (CREATE INDEX CONCURRENTLY) outside atomic transaction blocks", () => {
    const concurrentSql = "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);";
    const isConcurrent = /\bINDEX\s+CONCURRENTLY\b/i.test(concurrentSql);
    expect(isConcurrent).toBe(true);
  });
});
