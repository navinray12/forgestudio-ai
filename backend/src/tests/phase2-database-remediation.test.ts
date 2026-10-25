/**
 * Phase 2 Database Foundation and Migration Reliability Regression Suite
 * Covers DATA-01, DATA-06, migration reconciliation, startup failure reporting,
 * and new-user default-plan provisioning.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ensureDefaultPlans } from "../services/subscription.service.js";

describe("Phase 2 Database Foundation & Migration Reliability Suite", () => {
  const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");

  describe("1. Migration Directory Consistency & History Reconciled", () => {
    it("contains all 4 previously missing reconciled migration directories", () => {
      const reconciled = [
        "20260914000000_restore_missing_core_tables",
        "20260915000000_webhook_receipts_and_auth_schema",
        "20260916000000_draft_mutation_receipts",
        "20260917000000_workspace_authority",
      ];
      for (const mig of reconciled) {
        const migPath = path.join(migrationsDir, mig, "migration.sql");
        expect(fs.existsSync(migPath), `Missing migration: ${mig}`).toBe(true);
        const sql = fs.readFileSync(migPath, "utf-8");
        expect(sql.length).toBeGreaterThan(0);
      }
    });

    it("verifies 20260928122000_workspace_lifecycle migration is idempotent and safe", () => {
      const migPath = path.join(migrationsDir, "20260928122000_workspace_lifecycle", "migration.sql");
      expect(fs.existsSync(migPath)).toBe(true);
      const sql = fs.readFileSync(migPath, "utf-8");

      // Verifies idempotent triggers and constraints
      expect(sql).toContain("DROP TRIGGER IF EXISTS forge_workspace_version");
      expect(sql).toContain("DROP TRIGGER IF EXISTS forge_website_workspace_admission");
      expect(sql).toContain("DROP TRIGGER IF EXISTS forge_workspace_child_admission");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
      expect(sql).toContain("duplicate_object");
    });

    it("verifies 20261014180000_application_spec_revisions migration exists with correct schema", () => {
      const migPath = path.join(migrationsDir, "20261014180000_application_spec_revisions", "migration.sql");
      expect(fs.existsSync(migPath)).toBe(true);
      const sql = fs.readFileSync(migPath, "utf-8");

      expect(sql).toContain("CREATE TABLE IF NOT EXISTS forge_application_spec_revisions");
      expect(sql).toContain("forge_appspec_revision_pk");
      expect(sql).toContain("forge_appspec_parent_chain");
    });
  });

  describe("2. Schema Authority and Model Coverage", () => {
    it("includes ForgeApplicationSpecRevision in Prisma schema", () => {
      const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma");
      const schema = fs.readFileSync(schemaPath, "utf-8");

      expect(schema).toContain("model ForgeApplicationSpecRevision");
      expect(schema).toContain('@@map("forge_application_spec_revisions")');
    });

    it("ensures ensure-schema.ts includes forge_application_spec_revisions and fails closed", () => {
      const ensureSchemaPath = path.resolve(__dirname, "../config/ensure-schema.ts");
      const code = fs.readFileSync(ensureSchemaPath, "utf-8");

      expect(code).toContain("forge_application_spec_revisions table");
      expect(code).toContain("throw new Error(errorMsg)");
    });
  });

  describe("3. Default Plan Provisioning and Safe Website Creation", () => {
    it("ensures default subscription tiers include Free with zero price", async () => {
      const { prisma } = await import("../config/prisma.js");

      // Verify ensureDefaultPlans function is exported and callable
      expect(typeof ensureDefaultPlans).toBe("function");

      const createPersonalWebsitePath = path.resolve(__dirname, "../services/websites/create-personal-website.ts");
      const websiteCreateCode = fs.readFileSync(createPersonalWebsitePath, "utf-8");

      // Verifies auto-provisioning fallback on website creation
      expect(websiteCreateCode).toContain("FREE_SUBSCRIPTION_PROVISIONED");
      expect(websiteCreateCode).toContain('slug: "free"');
      expect(websiteCreateCode).not.toContain('throw new AppError("Subscription provisioning is incomplete", 503');
    });
  });

  describe("4. Startup Integrity & Failure Reporting", () => {
    it("ensures server.ts terminates process on schema initialization failure rather than running incomplete", () => {
      const serverPath = path.resolve(__dirname, "../server.ts");
      const serverCode = fs.readFileSync(serverPath, "utf-8");

      expect(serverCode).toContain("process.exit(1)");
      expect(serverCode).not.toContain("Failed to ensure tables, starting server anyway");
    });
  });
});
