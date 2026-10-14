/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Test Suite 2: Governed Activation & Disable/Exit Lifecycle (CAP-117, CAP-118)
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateActivationPrerequisites,
  previewDisableImpact,
  executeGovernedActivation,
  executeGovernedDisable,
  getTransitionHistory,
} from "../services/capabilities/lifecycleGovernor.js";
import {
  generateAdminNavigation,
  isCapabilityApiAllowed,
} from "../services/capabilities/capabilityManifest.js";

test("Point 05 — Governed Activation & Disable/Exit Lifecycle Suite", async (t) => {
  await t.test("1. Activation Prerequisite Gating: Blocks activation when dependencies or credentials missing", () => {
    // CAP-020 depends on CAP-018
    const blockedReport = evaluateActivationPrerequisites("CAP-020", {
      activeCapabilities: [], // CAP-018 is missing!
    });
    assert.equal(blockedReport.canActivate, false, "Must block activation when parent dependency is inactive");
    assert.ok(blockedReport.blockerCount >= 1);
    assert.ok(blockedReport.prerequisites.some((p) => p.category === "DEPENDENCY" && p.status === "MISSING"));

    // External integration (CAP-086 WordPress) requires credentials
    const wpBlocked = evaluateActivationPrerequisites("CAP-086", {
      activeCapabilities: ["CAP-005"],
      configuredCredentials: { "CAP-086": false }, // No credentials!
    });
    assert.equal(wpBlocked.canActivate, false, "Must block external integration when credentials missing");
    assert.ok(wpBlocked.prerequisites.some((p) => p.category === "CREDENTIAL" && p.status === "MISSING"));
  });

  await t.test("2. Successful Governed Activation: Transitions to ACTIVE with complete audit record", () => {
    // Fulfill all prerequisites for CAP-020 (active CAP-018)
    const report = evaluateActivationPrerequisites("CAP-020", {
      activeCapabilities: ["CAP-018"],
    });
    assert.equal(report.canActivate, true, "Must permit activation when all prerequisites are fulfilled");

    const transition = executeGovernedActivation("CAP-020", "user-admin-1", {
      activeCapabilities: ["CAP-018"],
    });
    assert.equal(transition.action, "ACTIVATED");
    assert.equal(transition.newState, "ACTIVE");
    assert.ok(transition.transitionId.startsWith("trans-"));
  });

  await t.test("3. Disable Impact Preview: Truthfully exposes affected routes and masked credentials", () => {
    const preview = previewDisableImpact("CAP-086", {
      activeCapabilities: ["CAP-086", "CAP-088"], // CAP-088 depends on CAP-086!
      inFlightJobsCount: 2,
    });

    assert.equal(preview.capId, "CAP-086");
    assert.ok(preview.downstreamDependentCaps.some((d) => d.includes("CAP-088")), "Must identify downstream dependents");
    assert.equal(preview.inFlightJobsCount, 2);
    assert.ok(preview.credentialsToRevoke.some((c) => c.includes("Masked")), "Credentials must be masked; no secret leakage");
    assert.ok(preview.retainedDataSummary.length > 0, "Must confirm retained data preservation");
  });

  await t.test("4. Governed Disable Execution: Protects locked capabilities and drains in-flight jobs", () => {
    // A. Locked foundation capability (CAP-001) cannot be disabled
    assert.throws(
      () => executeGovernedDisable("CAP-001", "user-admin-2"),
      /locked and cannot be disabled/,
      "Must forbid disabling locked foundation capability"
    );

    // B. Business module (CAP-101 Commerce) disabled safely
    const disableResult = executeGovernedDisable("CAP-101", "user-admin-2", {
      inFlightJobsToDrain: 3,
    });

    assert.equal(disableResult.action, "DISABLED");
    assert.equal(disableResult.newState, "DISABLED_WITH_RETAINED_DATA");
    assert.equal(disableResult.jobsDrainedCount, 3);
    assert.ok(disableResult.recordsRetainedCount >= 1, "Must retain existing records");

    // Verify audit log captured transition
    const history = getTransitionHistory("CAP-101");
    assert.ok(history.length >= 1, "Must record transition in audit log");
  });

  await t.test("5. Manifest Runtime Integration: Admin Navigation and API route enforcement", () => {
    // A. Admin navigation updates based on active capabilities
    const activeCaps = ["CAP-011", "CAP-016", "CAP-021"];
    const nav = generateAdminNavigation(activeCaps);

    const overviewNav = nav.find((n) => n.id === "nav-overview");
    assert.equal(overviewNav?.status, "AVAILABLE");

    const commerceNav = nav.find((n) => n.id === "nav-commerce");
    assert.equal(commerceNav?.status, "DISABLED", "Inactive business module must show DISABLED in admin nav");

    // B. Direct API gate enforcement
    const allowed = isCapabilityApiAllowed("CAP-011", activeCaps);
    assert.equal(allowed.allowed, true, "Active/Foundation cap must allow API request");

    const blocked = isCapabilityApiAllowed("CAP-101", activeCaps); // Inactive B module
    assert.equal(blocked.allowed, false, "Inactive capability must reject direct API request");
    assert.ok(blocked.reason?.includes("not activated"));
  });
});
