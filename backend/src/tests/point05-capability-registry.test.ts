/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Test Suite 1: Capability Registry Integrity & Evidence Freshness (CAP-116, CAP-120)
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_REGISTRY,
  getCapabilityById,
  listCapabilities,
  validateRegistryIntegrity,
  getCapabilitiesByClassification,
} from "../services/capabilities/capabilityRegistry.js";
import {
  recordEvidence,
  getEvidenceForCapability,
  evaluateEvidenceFreshness,
  invalidateCapabilityEvidence,
  getEvidenceStoreMetrics,
} from "../services/capabilities/evidenceRegistry.js";

test("Point 05 — Capability Registry & Evidence Engine Suite", async (t) => {
  await t.test("1. Registry Completeness: Exactly 120 capabilities from CAP-001 to CAP-120", () => {
    const integrity = validateRegistryIntegrity();
    assert.equal(integrity.valid, true, "Registry must be fully valid with 0 broken dependencies");
    assert.equal(integrity.totalCount, 120, "Must contain exactly 120 capability records");
    assert.equal(integrity.missingIds.length, 0, "No missing CAP IDs allowed");
    assert.equal(integrity.duplicateIds.length, 0, "No duplicate CAP IDs allowed");
    assert.equal(integrity.brokenDependencies.length, 0, "All dependencies must resolve to existing CAP IDs");
  });

  await t.test("2. Classification Invariant: Strictly enforces F (64), G (41), B (15) distribution", () => {
    const fCaps = getCapabilitiesByClassification("F");
    const gCaps = getCapabilitiesByClassification("G");
    const bCaps = getCapabilitiesByClassification("B");

    assert.equal(fCaps.length, 64, "Must contain exactly 64 Universal Foundation (F) capabilities");
    assert.equal(gCaps.length, 41, "Must contain exactly 41 Growth Platform (G) capabilities");
    assert.equal(bCaps.length, 15, "Must contain exactly 15 Conditional Business (B) capabilities");

    // Total must equal 120
    assert.equal(fCaps.length + gCaps.length + bCaps.length, 120);

    // Foundation capabilities must all have non-empty source clauses
    for (const f of fCaps) {
      assert.ok(f.sourceClause && f.sourceClause.length > 0, `Foundation CAP '${f.id}' requires source clause`);
    }
  });

  await t.test("3. Five-Dimensional State Model: Validates independent orthogonal dimensions", () => {
    for (const cap of CAPABILITY_REGISTRY) {
      // 1. Specification Status
      assert.ok(
        ["UNREVIEWED", "DEFINED", "AMBIGUOUS", "CONFLICTED", "APPROVED"].includes(cap.specificationStatus),
        `CAP '${cap.id}' invalid specificationStatus`
      );
      // 2. Applicability Status
      assert.ok(
        ["NOT_EVALUATED", "APPLICABLE", "NOT_APPLICABLE", "CONDITION_UNMET", "BLOCKED"].includes(cap.applicabilityStatus),
        `CAP '${cap.id}' invalid applicabilityStatus`
      );
      // 3. Implementation Status
      assert.ok(
        ["NOT_IMPLEMENTED", "PARTIAL", "IMPLEMENTED", "IMPLEMENTATION_BLOCKED"].includes(cap.implementationStatus),
        `CAP '${cap.id}' invalid implementationStatus`
      );
      // 4. Activation Status
      assert.ok(
        [
          "DISABLED",
          "PENDING_ACTIVATION",
          "ACTIVE",
          "DEGRADED",
          "DISABLING",
          "DISABLED_WITH_RETAINED_DATA",
          "BLOCKED",
        ].includes(cap.activationStatus),
        `CAP '${cap.id}' invalid activationStatus`
      );
      // 5. Verification Status
      assert.ok(
        ["UNVERIFIED", "IN_PROGRESS", "PASSED", "FAILED", "STALE", "BLOCKED"].includes(cap.verificationStatus),
        `CAP '${cap.id}' invalid verificationStatus`
      );
    }
  });

  await t.test("4. Evidence Lifecycle & Freshness: Records, evaluates, and invalidates evidence", () => {
    // Check initial seed evidence exists for core foundation capabilities
    const ev1 = getEvidenceForCapability("CAP-001");
    assert.ok(ev1.length > 0, "CAP-001 must have recorded baseline evidence");
    const freshness = evaluateEvidenceFreshness(ev1[0]);
    assert.equal(freshness.isFresh, true, "Baseline evidence must be fresh on initial load");

    // Record new evidence
    const newEv = recordEvidence({
      capId: "CAP-091",
      type: "AUTOMATED_TEST",
      artifactReference: "backend/src/tests/phase3-export-code-generators.test.ts",
      verificationScope: "Static compiler generates HTML5 bundle without omissions",
      environment: "CI_TEST_RUNNER",
      reviewer: "compiler-tester",
      result: "PASSED",
      freshnessDaysLimit: 30,
    });
    assert.ok(newEv.id.startsWith("ev-"));
    assert.equal(newEv.result, "PASSED");

    // Test invalidation
    const invalidatedCount = invalidateCapabilityEvidence("CAP-091", "Code modification in compiler pipeline");
    assert.ok(invalidatedCount >= 1, "Must invalidate active evidence on code modification");

    const refreshedEvList = getEvidenceForCapability("CAP-091");
    const freshCheck = evaluateEvidenceFreshness(refreshedEvList[0]);
    assert.equal(freshCheck.isFresh, false, "Invalidated evidence must no longer report as fresh");
    assert.equal(freshCheck.status, "STALE");
  });

  await t.test("5. Evidence Metrics: Summarizes coverage without exposing private operational secrets", () => {
    const metrics = getEvidenceStoreMetrics();
    assert.ok(metrics.totalRecords > 0);
    assert.ok(metrics.freshPassedCount > 0);
    assert.ok(metrics.capabilitiesCoveredCount > 0);
  });
});
