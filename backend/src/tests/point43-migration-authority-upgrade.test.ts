/**
 * ForgeStudio Test Suite — Blueprint Point 43: One Migration Authority and Safe Upgrade Lifecycle
 */

import { describe, it, expect } from "vitest";
import { unifiedMigrationAuthority } from "../services/migration/unifiedMigrationAuthority.service.js";

describe("Point 43 — One Migration Authority and Safe Upgrade Lifecycle", () => {
  const projectId = "proj_mig_43";
  const namespace = "customer_schema_43";

  describe("43.1 Namespace Authority & Competing Migration Engine Prevention", () => {
    it("claims physical namespace authority and prevents competing migration engines", () => {
      unifiedMigrationAuthority.claimNamespaceAuthority(namespace, "FORGE_MANAGED");

      // Attempting to claim the same physical namespace with a different authority must fail closed!
      expect(() =>
        unifiedMigrationAuthority.claimNamespaceAuthority(namespace, "PRISMA_QUALIFIED")
      ).toThrowError("Competing migration engines are forbidden!");
    });
  });

  describe("43.2 Immutable Migration Plan & 12 Lifecycle States", () => {
    it("creates an immutable migration plan with checksums and statement hazard classification", () => {
      const plan = unifiedMigrationAuthority.createMigrationPlan(
        projectId,
        "bind_proj_43_dev",
        namespace,
        "FORGE_MANAGED",
        [
          "CREATE TABLE app_posts (id uuid primary key, title text NOT NULL);",
          "CREATE UNIQUE INDEX uq_posts_title ON app_posts (title);",
          "CREATE INDEX CONCURRENTLY idx_posts_created ON app_posts (created_at);",
          "ALTER TABLE app_posts RENAME COLUMN title TO headline;",
        ]
      );

      expect(plan.planId).toBeTruthy();
      expect(plan.state).toBe("planned");
      expect(plan.statements.length).toBe(4);

      // Statement 1: Standard transactional
      expect(plan.statements[0].isTransactional).toBe(true);
      expect(plan.statements[0].hazardType).toBe("NOT_NULL_BACKFILL");

      // Statement 2: Unique check hazard
      expect(plan.statements[1].hazardType).toBe("DUPLICATE_CHECK");

      // Statement 3: Non-transactional concurrently index
      expect(plan.statements[2].isTransactional).toBe(false);

      // Statement 4: Rename preservation
      expect(plan.statements[3].hazardType).toBe("RENAME_PRESERVATION");
    });

    it("requires dual rehearsals (empty DB and prior-release DB) before approval", () => {
      const plan = unifiedMigrationAuthority.createMigrationPlan(
        projectId,
        "bind_proj_43_dev",
        namespace,
        "FORGE_MANAGED",
        ["CREATE TABLE app_items (id uuid primary key);"]
      );

      // Approval without rehearsal fails closed
      expect(() => unifiedMigrationAuthority.approveMigrationPlan(plan.planId, "user_admin")).toThrowError(
        "Both dual rehearsals must pass before approval"
      );

      // Rehearsal passes both
      const rehearsal = unifiedMigrationAuthority.rehearseMigrationPlan(plan.planId);
      expect(rehearsal.emptyDbPassed).toBe(true);
      expect(rehearsal.priorReleaseDbPassed).toBe(true);
      expect(rehearsal.state).toBe("rehearsed");

      // Approval succeeds
      const approved = unifiedMigrationAuthority.approveMigrationPlan(plan.planId, "user_admin");
      expect(approved.state).toBe("approved");
      expect(approved.approvedBy).toBe("user_admin");
    });

    it("executes approved migration plan with fenced concurrency lease", () => {
      const plan = unifiedMigrationAuthority.createMigrationPlan(
        projectId,
        "bind_proj_43_dev",
        namespace,
        "FORGE_MANAGED",
        ["CREATE TABLE app_items_2 (id uuid primary key);"]
      );

      unifiedMigrationAuthority.rehearseMigrationPlan(plan.planId);
      unifiedMigrationAuthority.approveMigrationPlan(plan.planId, "user_admin");

      const execution = unifiedMigrationAuthority.executeMigrationPlan(plan.planId);
      expect(execution.applied).toBe(true);
      expect(execution.state).toBe("applied");
      expect(execution.checksumMatches).toBe(true);
    });

    it("enforces fenced lease concurrency lock to prevent overlapping runs", () => {
      const lease1 = unifiedMigrationAuthority.acquireFencedLease("isolated_ns_99");
      expect(lease1.startsWith("lease_")).toBe(true);

      // Concurrent lease attempt throws 423 locked
      expect(() => unifiedMigrationAuthority.acquireFencedLease("isolated_ns_99")).toThrowError(
        "Migration lease for namespace 'isolated_ns_99' is already held"
      );

      // Release allows subsequent acquisition
      unifiedMigrationAuthority.releaseFencedLease("isolated_ns_99", lease1);
      const lease2 = unifiedMigrationAuthority.acquireFencedLease("isolated_ns_99");
      expect(lease2).toBeTruthy();
      unifiedMigrationAuthority.releaseFencedLease("isolated_ns_99", lease2);
    });
  });

  describe("43.3 Uncertain Outcomes & Forward Fix Recovery", () => {
    it("reconciles uncertain outcome when DDL succeeds but control-plane was unacknowledged", () => {
      const plan = unifiedMigrationAuthority.createMigrationPlan(
        projectId,
        "bind_proj_43_dev",
        namespace,
        "FORGE_MANAGED",
        ["CREATE TABLE app_items_3 (id uuid primary key);"]
      );

      // Scenario A: Observed catalog matches target schema hash
      const reconciledSuccess = unifiedMigrationAuthority.reconcileUncertainOutcome(plan.planId, [
        plan.targetSchemaHash,
      ]);
      expect(reconciledSuccess.reconciledState).toBe("applied");
      expect(reconciledSuccess.evidenceMatches).toBe(true);

      // Scenario B: Observed catalog does NOT match target schema hash
      const planMismatch = unifiedMigrationAuthority.createMigrationPlan(
        projectId,
        "bind_proj_43_dev",
        namespace,
        "FORGE_MANAGED",
        ["CREATE TABLE app_items_4 (id uuid primary key);"]
      );
      const reconciledMismatch = unifiedMigrationAuthority.reconcileUncertainOutcome(planMismatch.planId, [
        "some_other_stale_hash",
      ]);
      expect(reconciledMismatch.reconciledState).toBe("recovery-required");
      expect(reconciledMismatch.evidenceMatches).toBe(false);
    });

    it("generates a safe forward-fix migration plan rather than an unsafe down migration", () => {
      const failedPlan = unifiedMigrationAuthority.createMigrationPlan(
        projectId,
        "bind_proj_43_dev",
        namespace,
        "FORGE_MANAGED",
        ["CREATE TABLE broken (id int);"]
      );

      const forwardFix = unifiedMigrationAuthority.createForwardFixPlan(projectId, failedPlan.planId, [
        "ALTER TABLE broken ADD COLUMN repaired text;",
      ]);

      expect(forwardFix.planId).toBeTruthy();
      expect(forwardFix.planId).not.toBe(failedPlan.planId);
      expect(forwardFix.state).toBe("planned");
    });
  });
});
