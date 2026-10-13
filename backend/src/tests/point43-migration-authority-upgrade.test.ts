/**
 * Point 43 — One Migration Authority and Safe Upgrade Lifecycle: plan analysis.
 *
 * These cases need no database: they cover how a plan's statements are classified and which
 * statements a plan may not contain. The lifecycle itself (preflight, dual rehearsal, approval,
 * execution, reconciliation) runs real DDL and is covered against PostgreSQL in
 * migration-authority.integration.test.ts. The earlier version of this file asserted that an
 * in-memory authority reported "applied" without touching a database; that behaviour was removed.
 */
import { describe, it, expect } from "vitest";
import { analyzeStatement, normalizeEnvironment, unifiedMigrationAuthority } from "../services/migration/unifiedMigrationAuthority.service.js";

const SCHEMA = "forge_cust_p43_development";
const analyze = (sql: string) => analyzeStatement(sql, 1, SCHEMA);

describe("Point 43 — One Migration Authority and Safe Upgrade Lifecycle", () => {
  describe("43.1 Namespace ownership", () => {
    it("refuses statements that leave the database's own schema or change what the authority does not own", () => {
      for (const sql of [
        "DROP TABLE public.users",
        "ALTER TABLE forge_cust_other_development.accounts ADD COLUMN x int",
        "CREATE TABLE pg_catalog.x (id int)",
        "SET search_path = public",
        "CREATE SCHEMA elsewhere",
        "DROP SCHEMA public CASCADE",
        "CREATE EXTENSION pgcrypto",
        "CREATE ROLE intruder",
        "GRANT ALL ON accounts TO PUBLIC",
        "COPY accounts TO PROGRAM 'curl example.test'",
      ]) {
        expect(() => analyze(sql), sql).toThrowError(/Statement 1/);
      }
      expect(analyze(`CREATE TABLE ${SCHEMA}.accounts (id uuid PRIMARY KEY)`).sql).toContain("accounts");
    });

    it("has no in-memory plan store or simulated execution left", () => {
      const authority = unifiedMigrationAuthority as unknown as Record<string, unknown>;
      for (const removed of ["createMigrationPlan", "rehearseMigrationPlan", "approveMigrationPlan", "executeMigrationPlan", "claimNamespaceAuthority", "acquireFencedLease", "reconcileUncertainOutcome"]) {
        expect(authority[removed], removed).toBeUndefined();
      }
      expect(Object.values(authority).some((value) => value instanceof Map)).toBe(false);
    });
  });

  describe("43.2 Immutable plan statements", () => {
    it("gives each statement a checksum and refuses more than one statement per entry", () => {
      const a = analyze("CREATE TABLE accounts (id uuid PRIMARY KEY, email text)");
      const b = analyze("CREATE TABLE accounts (id uuid PRIMARY KEY, email text);");
      expect(a.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(b.checksum).toBe(a.checksum);
      expect(analyze("CREATE TABLE accounts (id uuid PRIMARY KEY)").checksum).not.toBe(a.checksum);
      expect(() => analyze("CREATE TABLE a (id int); DROP TABLE b")).toThrowError(/more than one SQL statement/);
      expect(() => analyze("SELECT 1")).toThrowError(/Statement 1/);
      expect(() => analyze("COMMIT")).toThrowError(/Statement 1/);
      // Text inside a literal, a comment or a dollar-quoted body is not syntax.
      expect(analyze("INSERT INTO notes (body) VALUES ('a; DROP TABLE public.users; --')").destructive).toBe(false);
      expect(analyze("COMMENT ON TABLE notes IS 'see public.users'").destructive).toBe(false);
    });

    it("models statements that cannot run in a transaction as phases of their own", () => {
      expect(analyze("CREATE INDEX CONCURRENTLY idx_acc_email ON accounts (email)").transactional).toBe(false);
      expect(analyze("DROP INDEX CONCURRENTLY idx_acc_email").transactional).toBe(false);
      expect(analyze("REINDEX INDEX CONCURRENTLY idx_acc_email").transactional).toBe(false);
      expect(analyze("CREATE INDEX idx_acc_email ON accounts (email)").transactional).toBe(true);
    });
  });

  describe("43.3 Hazards", () => {
    it("marks uniqueness rules for a duplicate check", () => {
      expect(analyze("CREATE UNIQUE INDEX ux ON accounts (email)").hazards).toEqual([{ type: "DUPLICATE_CHECK", table: "accounts", columns: ["email"] }]);
      expect(analyze("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux ON accounts (tenant_id, email)").hazards).toEqual([{ type: "DUPLICATE_CHECK", table: "accounts", columns: ["tenant_id", "email"] }]);
      expect(analyze("ALTER TABLE accounts ADD CONSTRAINT accounts_email_key UNIQUE (email)").hazards).toEqual([{ type: "DUPLICATE_CHECK", table: "accounts", columns: ["email"] }]);
      expect(analyze("ALTER TABLE accounts ADD PRIMARY KEY (id)").hazards).toEqual([{ type: "DUPLICATE_CHECK", table: "accounts", columns: ["id"] }]);
      // Over an expression the duplicates cannot be checked beforehand: no column list.
      expect(analyze("CREATE UNIQUE INDEX ux ON accounts (lower(email))").hazards).toEqual([{ type: "DUPLICATE_CHECK", table: "accounts", columns: undefined }]);
    });

    it("marks NOT NULL changes for a backfill check, and renames as renames", () => {
      expect(analyze("ALTER TABLE accounts ALTER COLUMN email SET NOT NULL").hazards).toEqual([{ type: "NOT_NULL_BACKFILL", table: "accounts", columns: ["email"], mode: "SET" }]);
      expect(analyze("ALTER TABLE accounts ADD COLUMN region text NOT NULL").hazards).toEqual([{ type: "NOT_NULL_BACKFILL", table: "accounts", columns: ["region"], mode: "ADD_NO_DEFAULT" }]);
      expect(analyze("ALTER TABLE accounts ADD COLUMN region text NOT NULL DEFAULT 'eu'").hazards).toEqual([]);
      expect(analyze("ALTER TABLE accounts RENAME COLUMN balance_cents TO balance_minor")).toMatchObject({ destructive: false, hazards: [{ type: "RENAME_PRESERVATION" }] });
    });

    it("marks statements that remove or rewrite data or structure as destructive", () => {
      for (const sql of [
        "DROP TABLE accounts",
        "ALTER TABLE accounts DROP COLUMN email",
        "TRUNCATE accounts",
        "DELETE FROM accounts WHERE id IS NULL",
        "ALTER TABLE accounts ALTER COLUMN balance TYPE smallint",
        "DO $$ BEGIN EXECUTE 'DROP TABLE accounts'; END $$",
      ]) {
        expect(analyze(sql).destructive, sql).toBe(true);
      }
      for (const sql of ["CREATE TABLE t (id int)", "ALTER TABLE accounts ADD COLUMN note text", "UPDATE accounts SET note = '' WHERE note IS NULL"]) {
        expect(analyze(sql).destructive, sql).toBe(false);
      }
    });
  });

  describe("43.4 Environment", () => {
    it("requires an explicit environment and reads the legacy label", () => {
      expect(normalizeEnvironment("production")).toBe("PRODUCTION");
      expect(normalizeEnvironment("preview")).toBe("STAGING");
      for (const missing of [undefined, null, "", "prod", "live"]) {
        expect(() => normalizeEnvironment(missing)).toThrowError(/explicit environment/);
      }
    });
  });
});
